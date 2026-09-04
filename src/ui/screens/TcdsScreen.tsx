import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { deleteTcdsDocument, listTcdsDocuments, type TcdsDocument } from "../../db/userdb";
import { resolveTcdsFile } from "../../db/tcdsFiles";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

// FAA Dynamic Regulatory System — hosts TCDS, AD, and other airworthiness
// documents. Its root path routes (client-side) to a search/browse landing
// page, so this works as a generic "start here" entry point.
const DRS_SEARCH_URL = "https://drs.faa.gov/";

type Props = NativeStackScreenProps<RootStackParamList, "Tcds">;

export default function TcdsScreen({ navigation }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [docs, setDocs] = useState<TcdsDocument[]>([]);

  const reload = useCallback(() => {
    listTcdsDocuments(userDb).then(setDocs);
  }, [userDb]);

  useFocusEffect(reload);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "TCDS",
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate("TcdsCapture", undefined)} hitSlop={12}>
          <Text style={styles.addButton}>Add</Text>
        </Pressable>
      ),
    });
  }, [navigation, styles.addButton]);

  const handleDelete = useCallback(
    (doc: TcdsDocument) => {
      Alert.alert("Delete TCDS", `Remove "${doc.label}" from offline storage?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const file = resolveTcdsFile(doc.file_path);
              if (file.exists) file.delete();
            } catch {
              // File already gone — still remove the record.
            }
            await deleteTcdsDocument(userDb, doc.id);
            reload();
          },
        },
      ]);
    },
    [userDb, reload]
  );

  return (
    <FlatList
      data={docs}
      keyExtractor={(d) => d.id}
      contentContainerStyle={docs.length === 0 && styles.emptyContainer}
      ListHeaderComponent={
        <Pressable
          onPress={() => navigation.navigate("TcdsCapture", { startUrl: DRS_SEARCH_URL })}
          style={({ pressed }) => [styles.searchRow, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.searchRowText}>Search for TCDS…</Text>
          <Text style={styles.searchRowHint}>
            Browse the FAA's Dynamic Regulatory System in-app to find one
          </Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate("TcdsViewer", { id: item.id })}
          onLongPress={() => handleDelete(item)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {new Date(item.saved_at).toLocaleDateString()} · {formatSize(item.file_size)}
            </Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>
          No TCDS documents saved yet. Tap “Add” and paste a link — e.g. an aircraft's Type Certificate
          Data Sheet from the FAA's Dynamic Regulatory System — to save it for offline use.
        </Text>
      }
    />
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    addButton: { color: colors.primary, fontWeight: "700", fontSize: 16 * fontScale },
    searchRow: {
      paddingHorizontal: spacing(2.5),
      paddingVertical: spacing(1.75),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchRowText: { fontSize: 16 * fontScale, fontWeight: "600", color: colors.primary },
    searchRowHint: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 3 },
    row: {
      paddingHorizontal: spacing(2.5),
      paddingVertical: spacing(1.75),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 16 * fontScale, fontWeight: "600", color: colors.text },
    rowMeta: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 3 },
    emptyContainer: { flex: 1 },
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: spacing(4),
      paddingHorizontal: spacing(3),
      fontSize: 14 * fontScale,
    },
  });
}

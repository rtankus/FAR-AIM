import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { PartSummary } from "../../content/types";
import { listParts } from "../../db/queries";
import { useSectionSearch } from "../hooks/useSectionSearch";
import { SectionListItem } from "../components/SectionListItem";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "PartsList">;

const SOURCE_LABEL: Record<string, string> = { FAR: "14 CFR", AIM: "AIM", AC: "Advisory Circulars" };

export default function PartsListScreen({ route, navigation }: Props) {
  const { source } = route.params;
  const db = useSQLiteContext();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const { query, results, onChangeQuery, active } = useSectionSearch(db, source);

  useEffect(() => {
    navigation.setOptions({
      title: source === "FAR" ? "14 CFR Parts" : source === "AIM" ? "AIM Chapters" : "Advisory Circulars",
    });
    listParts(db, source).then(setParts);
  }, [db, source, navigation]);

  return (
    <View style={styles.container}>
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder={`Search all of ${SOURCE_LABEL[source] ?? source}…`}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      {active ? (
        <FlatList
          data={results}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => (
            <SectionListItem section={item} onPress={() => navigation.navigate("Detail", { id: item.id })} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No results for "{query}"</Text>}
        />
      ) : (
        <FlatList
          data={parts}
          keyExtractor={(p) => p.part}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => navigation.navigate("SectionsList", { source, part: item.part })}
            >
              <Text style={styles.label}>{source === "AIM" ? item.part : `Part ${item.part}`}</Text>
              <Text style={styles.count}>{item.count}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    input: {
      margin: spacing(2),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      fontSize: 16 * fontScale,
      color: colors.text,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing(2),
      paddingHorizontal: spacing(2.5),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    rowPressed: { backgroundColor: colors.surface },
    label: { fontSize: 17 * fontScale, fontWeight: "600", color: colors.text },
    count: { fontSize: 13 * fontScale, color: colors.textMuted },
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(4), fontSize: 14 * fontScale },
  });
}

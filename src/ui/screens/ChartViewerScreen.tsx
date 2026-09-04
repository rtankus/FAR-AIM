import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { File, Paths } from "expo-file-system";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { addSavedChart, deleteSavedChart, getSavedChart, type SavedChart } from "../../db/userdb";
import { newChartDestination, resolveChartFile } from "../../db/chartFiles";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ChartViewer">;

export default function ChartViewerScreen({ route, navigation }: Props) {
  const { airportIdent, chartName, pdfUrl } = route.params;
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);

  const [saved, setSaved] = useState<SavedChart | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: chartName });
  }, [navigation, chartName]);

  useEffect(() => {
    getSavedChart(userDb, airportIdent, pdfUrl)
      .then(setSaved)
      .catch(() => setSaved(null)); // treat "couldn't check" as "not saved" rather than an infinite spinner
  }, [userDb, airportIdent, pdfUrl]);

  const localUri = saved && resolveChartFile(saved.file_path).exists ? resolveChartFile(saved.file_path).uri : null;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { file: dest, relativePath } = newChartDestination();
      // downloadFileAsync is itself an already-awaited-correctly async API
      // (unlike File.copy() — see db/database.ts's comment on that one).
      const file = await File.downloadFileAsync(pdfUrl, dest, { idempotent: true });
      if (file.size == null || file.size < 1000) throw new Error("The downloaded file looks incomplete — try again.");
      const row = await addSavedChart(userDb, {
        airportIdent,
        chartName,
        pdfUrl,
        filePath: relativePath,
        fileSize: file.size,
      });
      setSaved(row);
    } catch (err) {
      Alert.alert("Couldn't save chart", String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);
    }
  }, [airportIdent, chartName, pdfUrl, userDb]);

  const handleRemove = useCallback(async () => {
    if (!saved) return;
    try {
      const file = resolveChartFile(saved.file_path);
      if (file.exists) file.delete();
    } catch {
      // best-effort — still clear the db row below regardless
    }
    await deleteSavedChart(userDb, airportIdent, pdfUrl);
    setSaved(null);
  }, [airportIdent, pdfUrl, saved, userDb]);

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: localUri ?? pdfUrl }}
        style={styles.webview}
        originWhitelist={["*"]}
        // See TcdsViewerScreen's identical prop for why this is required to
        // load a local file:// PDF on iOS (WKWebView's sandboxed API).
        allowingReadAccessToURL={Paths.document.uri}
        allowFileAccess
      />
      <View style={styles.bar}>
        {saved === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : saved ? (
          <View style={styles.barRow}>
            <Text style={styles.savedText}>✓ Saved for offline viewing</Text>
            <Pressable onPress={handleRemove} style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <Text style={styles.removeLink}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.saveButton, (pressed || saving) && { opacity: 0.7 }]}
          >
            <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save for offline viewing"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    webview: { flex: 1 },
    bar: {
      padding: spacing(1.5),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    barRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    savedText: { color: colors.textMuted, fontSize: 13 * fontScale, fontWeight: "600" },
    removeLink: { color: colors.danger, fontSize: 13 * fontScale, fontWeight: "700" },
    saveButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing(1.25), alignItems: "center" },
    saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 * fontScale },
  });
}

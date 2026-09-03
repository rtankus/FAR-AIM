import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, type Appearance } from "../ThemeContext";
import { FONT_SIZE_LABELS, FONT_SCALES, type FontSizeKey, type ThemeColors } from "../theme";

const APPEARANCE_OPTIONS: { key: Appearance; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

const FONT_SIZE_OPTIONS = Object.keys(FONT_SCALES) as FontSizeKey[];

export default function SettingsScreen() {
  const { colors, spacing, appearance, setAppearance, fontSizeKey, setFontSizeKey } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing), [colors, spacing]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.segmentRow}>
        {APPEARANCE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setAppearance(opt.key)}
            style={[styles.segment, appearance === opt.key && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, appearance === opt.key && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Text Size</Text>
      <View style={styles.segmentRow}>
        {FONT_SIZE_OPTIONS.map((key) => (
          <Pressable
            key={key}
            onPress={() => setFontSizeKey(key)}
            style={[styles.segment, fontSizeKey === key && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, fontSizeKey === key && styles.segmentTextActive]}>
              {FONT_SIZE_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>Preview</Text>
        <Text style={[styles.previewBody, { fontSize: 17 * FONT_SCALES[fontSizeKey] }]}>
          No person may operate an aircraft in a careless or reckless manner so as to endanger the life or property of another.
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing(2.5) },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: spacing(2),
      marginBottom: spacing(1),
    },
    segmentRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 4,
      gap: 4,
    },
    segment: { flex: 1, paddingVertical: spacing(1.25), borderRadius: 8, alignItems: "center" },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { color: colors.text, fontWeight: "600", fontSize: 14 },
    segmentTextActive: { color: "#fff" },
    previewCard: {
      marginTop: spacing(4),
      padding: spacing(2),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    previewLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(1) },
    previewBody: { color: colors.text, lineHeight: 26 },
  });
}

import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import type { Section } from "../../content/types";

export function SectionListItem({
  section,
  onPress,
}: {
  section: Section;
  onPress: () => void;
}) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const badgeColor =
    section.source === "FAR" ? colors.farBadge : section.source === "AIM" ? colors.aimBadge : colors.acBadge;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{section.section_number}</Text>
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={2}>
          {section.title}
        </Text>
        <Text style={styles.path} numberOfLines={1}>
          {section.path}
        </Text>
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing(1.5),
      paddingHorizontal: spacing(2),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: spacing(1.5),
    },
    rowPressed: { backgroundColor: colors.surface },
    badge: {
      minWidth: 64,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
      alignItems: "center",
    },
    badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 * fontScale },
    textCol: { flex: 1 },
    title: { fontSize: 16 * fontScale, fontWeight: "600", color: colors.text },
    path: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 2 },
  });
}

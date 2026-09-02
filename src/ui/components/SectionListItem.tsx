import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";
import type { Section } from "../../content/types";

export function SectionListItem({
  section,
  onPress,
}: {
  section: Section;
  onPress: () => void;
}) {
  const badgeColor = section.source === "FAR" ? theme.colors.farBadge : theme.colors.aimBadge;
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

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing(1.5),
  },
  rowPressed: { backgroundColor: theme.colors.surface },
  badge: {
    minWidth: 64,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  textCol: { flex: 1 },
  title: { fontSize: 16, fontWeight: "600", color: theme.colors.text },
  path: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});

import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

/** Tappable section header that shows/hides its children — for long lists (PIREPs, nearby results, etc). */
export function Collapsible({
  title,
  count,
  defaultExpanded = true,
  children,
}: {
  title: string;
  count?: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View>
      <Pressable onPress={() => setExpanded((e) => !e)} style={styles.header}>
        <Text style={styles.title}>
          {title}
          {count != null ? ` (${count})` : ""}
        </Text>
        <Text style={styles.chevron}>{expanded ? "▲" : "▼"}</Text>
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing(1),
      marginTop: spacing(1.5),
    },
    title: {
      fontSize: 13 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    chevron: { fontSize: 11 * fontScale, color: colors.textMuted },
  });
}

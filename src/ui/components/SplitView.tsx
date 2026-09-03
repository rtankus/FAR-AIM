import { useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

/**
 * Two-pane layout used on tablets: a master list on the left, detail content
 * on the right, both visible at once. Phones use plain stack navigation
 * instead (see useIsTablet).
 */
export function SplitView({ master, detail }: { master: ReactNode; detail: ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.master}>{master}</View>
      <View style={styles.detail}>{detail}</View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flex: 1, flexDirection: "row" },
    master: {
      width: 360,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.border,
    },
    detail: { flex: 1 },
  });
}

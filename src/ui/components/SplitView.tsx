import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../theme";

/**
 * Two-pane layout used on tablets: a master list on the left, detail content
 * on the right, both visible at once. Phones use plain stack navigation
 * instead (see useIsTablet).
 */
export function SplitView({ master, detail }: { master: ReactNode; detail: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.master}>{master}</View>
      <View style={styles.detail}>{detail}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row" },
  master: {
    width: 360,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.border,
  },
  detail: { flex: 1 },
});

import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { PartSummary } from "../../content/types";
import { listParts } from "../../db/queries";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "PartsList">;

export default function PartsListScreen({ route, navigation }: Props) {
  const { source } = route.params;
  const db = useSQLiteContext();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [parts, setParts] = useState<PartSummary[]>([]);

  useEffect(() => {
    navigation.setOptions({ title: source === "FAR" ? "14 CFR Parts" : "AIM Chapters" });
    listParts(db, source).then(setParts);
  }, [db, source, navigation]);

  return (
    <FlatList
      data={parts}
      keyExtractor={(p) => p.part}
      renderItem={({ item }) => (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigation.navigate("SectionsList", { source, part: item.part })}
        >
          <Text style={styles.label}>{source === "FAR" ? `Part ${item.part}` : item.part}</Text>
          <Text style={styles.count}>{item.count}</Text>
        </Pressable>
      )}
    />
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
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
  });
}

import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { PartSummary } from "../../content/types";
import { listParts } from "../../db/queries";
import { theme } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "PartsList">;

export default function PartsListScreen({ route, navigation }: Props) {
  const { source } = route.params;
  const db = useSQLiteContext();
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

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(2.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowPressed: { backgroundColor: theme.colors.surface },
  label: { fontSize: 17, fontWeight: "600", color: theme.colors.text },
  count: { fontSize: 13, color: theme.colors.textMuted },
});

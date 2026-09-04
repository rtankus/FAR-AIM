import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Section } from "../../content/types";
import { listSectionsInPart } from "../../db/queries";
import { useSectionSearch } from "../hooks/useSectionSearch";
import { SectionListItem } from "../components/SectionListItem";
import { SplitView } from "../components/SplitView";
import { SectionDetailPlaceholder, SectionDetailView } from "../components/SectionDetailView";
import { useIsTablet } from "../hooks/useIsTablet";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "SectionsList">;

export default function SectionsListScreen({ route, navigation }: Props) {
  const { source, part } = route.params;
  const db = useSQLiteContext();
  const isTablet = useIsTablet();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { query, results, onChangeQuery, active } = useSectionSearch(db, source, part);

  useEffect(() => {
    navigation.setOptions({ title: source === "AIM" ? part : `Part ${part}` });
    listSectionsInPart(db, source, part).then((rows) => {
      setSections(rows);
      if (isTablet) setSelectedId((current) => current ?? rows[0]?.id ?? null);
    });
    // isTablet intentionally excluded: switching orientation mid-screen shouldn't refetch/reset selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, source, part, navigation]);

  const onSelect = (id: string) => (isTablet ? setSelectedId(id) : navigation.navigate("Detail", { id }));

  const list = (
    <View style={styles.listCol}>
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder={`Search Part ${part}…`}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <FlatList
        data={active ? results : sections}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <SectionListItem section={item} onPress={() => onSelect(item.id)} />}
        ListEmptyComponent={active ? <Text style={styles.empty}>No results for "{query}"</Text> : null}
      />
    </View>
  );

  if (!isTablet) return list;

  return (
    <SplitView
      master={list}
      detail={
        selectedId ? (
          <SectionDetailView id={selectedId} />
        ) : (
          <SectionDetailPlaceholder message="Select a section to read it." />
        )
      }
    />
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    listCol: { flex: 1, backgroundColor: colors.background },
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
    empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing(4), fontSize: 14 * fontScale },
  });
}

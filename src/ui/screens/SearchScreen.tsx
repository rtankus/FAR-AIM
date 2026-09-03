import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Section } from "../../content/types";
import { searchSections } from "../../db/queries";
import { SectionListItem } from "../components/SectionListItem";
import { SplitView } from "../components/SplitView";
import { SectionDetailPlaceholder, SectionDetailView } from "../components/SectionDetailView";
import { useIsTablet } from "../hooks/useIsTablet";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;

export default function SearchScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const isTablet = useIsTablet();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Section[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const runSearch = useCallback(
    async (text: string) => {
      setQuery(text);
      if (text.trim().length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      const rows = await searchSections(db, text);
      setResults(rows);
      setSearched(true);
      setSelectedId(rows[0]?.id ?? null);
    },
    [db]
  );

  const list = (
    <View style={styles.listCol}>
      <TextInput
        autoFocus
        value={query}
        onChangeText={runSearch}
        placeholder="Search FAR & AIM (e.g. “right of way”, “91.3”)"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="search"
      />
      <FlatList
        data={results}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <SectionListItem
            section={item}
            onPress={() =>
              isTablet ? setSelectedId(item.id) : navigation.navigate("Detail", { id: item.id })
            }
          />
        )}
        ListEmptyComponent={
          searched ? <Text style={styles.empty}>No results for "{query}"</Text> : null
        }
      />
    </View>
  );

  if (!isTablet) return <View style={styles.container}>{list}</View>;

  return (
    <SplitView
      master={list}
      detail={
        selectedId ? (
          <SectionDetailView id={selectedId} />
        ) : (
          <SectionDetailPlaceholder message="Search results will open here." />
        )
      }
    />
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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

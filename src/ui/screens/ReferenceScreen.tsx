import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Section } from "../../content/types";
import { searchSections } from "../../db/queries";
import { SectionListItem } from "../components/SectionListItem";
import { SplitView } from "../components/SplitView";
import { SectionDetailPlaceholder, SectionDetailView } from "../components/SectionDetailView";
import RulemakingHomeCard from "../components/RulemakingHomeCard";
import { useIsTablet } from "../hooks/useIsTablet";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Reference">;

/** Reference tab: search FAR/AIM/AC, browse by part, TCDS, bookmarks, rulemaking. */
export default function ReferenceScreen({ navigation }: Props) {
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

  const openSection = useCallback(
    (id: string) => (isTablet ? setSelectedId(id) : navigation.navigate("Detail", { id })),
    [isTablet, navigation]
  );

  const browse = (
    <View style={styles.container}>
      <View style={styles.grid}>
        <NavCard label="Browse FARs" hint="14 CFR by Part" onPress={() => navigation.navigate("PartsList", { source: "FAR" })} />
        <NavCard label="Browse AIM" hint="By Chapter" onPress={() => navigation.navigate("PartsList", { source: "AIM" })} />
        <NavCard label="Browse ACs" hint="Advisory Circulars" onPress={() => navigation.navigate("PartsList", { source: "AC" })} />
        <NavCard label="TCDS" hint="Saved aircraft data sheets" onPress={() => navigation.navigate("Tcds")} />
        <NavCard label="Bookmarks" hint="Saved sections" onPress={() => navigation.navigate("Bookmarks")} />
      </View>
      <RulemakingHomeCard onPress={() => navigation.navigate("Rulemaking")} />
    </View>
  );

  const list = (
    <View style={styles.listCol}>
      <TextInput
        value={query}
        onChangeText={runSearch}
        placeholder="Search FAR & AIM (e.g. “right of way”, “91.3”)"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="search"
      />
      {searched ? (
        <FlatList
          data={results}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <SectionListItem section={item} onPress={() => openSection(item.id)} />}
          ListEmptyComponent={<Text style={styles.empty}>No results for "{query}"</Text>}
        />
      ) : (
        browse
      )}
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
          <SectionDetailPlaceholder message="Search results will open here." />
        )
      }
    />
  );
}

function NavCard({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </Pressable>
  );
}

function makeCardStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    card: {
      width: "47%",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing(2),
      marginBottom: spacing(2),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    label: { fontSize: 17 * fontScale, fontWeight: "700", color: colors.text },
    hint: { fontSize: 13 * fontScale, color: colors.textMuted, marginTop: 4 },
  });
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing(2.5) },
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
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  });
}

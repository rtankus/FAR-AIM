import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Section } from "../../content/types";
import { getSectionsByIds } from "../../db/queries";
import { listBookmarkedSectionIds } from "../../db/userdb";
import { useUserDb } from "../UserDbContext";
import { SectionListItem } from "../components/SectionListItem";
import { SplitView } from "../components/SplitView";
import { SectionDetailPlaceholder, SectionDetailView } from "../components/SectionDetailView";
import { useIsTablet } from "../hooks/useIsTablet";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Bookmarks">;

export default function BookmarksScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const userDb = useUserDb();
  const isTablet = useIsTablet();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [bookmarks, setBookmarks] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Re-fetch every time this screen gains focus, since bookmarks are toggled
  // from the detail view and we want the list to reflect that on return.
  useFocusEffect(
    useCallback(() => {
      listBookmarkedSectionIds(userDb).then(async (ids) => {
        const rows = await getSectionsByIds(db, ids);
        setBookmarks(rows);
        setSelectedId((current) => current ?? rows[0]?.id ?? null);
      });
    }, [db, userDb])
  );

  const list = (
    <FlatList
      data={bookmarks}
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
        <Text style={styles.empty}>No bookmarks yet. Open any section and tap “Bookmark”.</Text>
      }
    />
  );

  if (!isTablet) return list;

  return (
    <SplitView
      master={list}
      detail={
        selectedId ? (
          <SectionDetailView id={selectedId} />
        ) : (
          <SectionDetailPlaceholder message="Bookmark a section to see it here." />
        )
      }
    />
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    empty: {
      textAlign: "center",
      color: colors.textMuted,
      marginTop: spacing(4),
      paddingHorizontal: spacing(3),
      fontSize: 14 * fontScale,
    },
  });
}

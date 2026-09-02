import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { Section } from "../../content/types";
import { getSection, isBookmarked, recordRecentlyViewed, toggleBookmark } from "../../db/queries";
import { theme } from "../theme";

/**
 * Renders one section's title/body/bookmark control. Used both as the whole
 * screen (phone, pushed via navigation) and embedded in the right-hand pane
 * of a tablet SplitView.
 */
export function SectionDetailView({
  id,
  onTitleChange,
}: {
  id: string;
  onTitleChange?: (title: string) => void;
}) {
  const db = useSQLiteContext();
  const [section, setSection] = useState<Section | null>(null);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSection(null);
    (async () => {
      const s = await getSection(db, id);
      if (cancelled || !s) return;
      setSection(s);
      setBookmarked(await isBookmarked(db, id));
      onTitleChange?.(s.section_number);
      recordRecentlyViewed(db, id);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, id, onTitleChange]);

  const handleToggleBookmark = useCallback(async () => {
    const nowBookmarked = await toggleBookmark(db, id);
    setBookmarked(nowBookmarked);
  }, [db, id]);

  if (!section) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.path}>{section.path}</Text>
      <Text style={styles.title}>{section.title}</Text>
      <Text style={styles.body}>{section.body}</Text>

      <View style={styles.actions}>
        <Pressable
          onPress={handleToggleBookmark}
          style={({ pressed }) => [
            styles.bookmarkButton,
            bookmarked && styles.bookmarkButtonActive,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.bookmarkText, bookmarked && styles.bookmarkTextActive]}>
            {bookmarked ? "★ Bookmarked" : "☆ Bookmark this section"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export function SectionDetailPlaceholder({ message }: { message: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(2.5), paddingBottom: theme.spacing(6) },
  path: { fontSize: 12, color: theme.colors.textMuted, marginBottom: theme.spacing(1) },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.text, marginBottom: theme.spacing(2) },
  body: { fontSize: 17, lineHeight: 26, color: theme.colors.text },
  actions: { marginTop: theme.spacing(4) },
  bookmarkButton: {
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: theme.spacing(1.5),
    alignItems: "center",
  },
  bookmarkButtonActive: { backgroundColor: theme.colors.primary },
  bookmarkText: { color: theme.colors.primary, fontWeight: "700" },
  bookmarkTextActive: { color: "#fff" },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing(3),
  },
  placeholderText: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center" },
});

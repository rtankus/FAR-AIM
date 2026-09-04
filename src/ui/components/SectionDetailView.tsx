import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { Section } from "../../content/types";
import { tokenizeBody } from "../../content/tokenize";
import { getSection } from "../../db/queries";
import {
  addDrawing,
  addHighlight,
  clearDrawingsForSection,
  deleteDrawing,
  deleteHighlight,
  isBookmarked,
  listDrawingsForSection,
  listHighlightsForSection,
  recordRecentlyViewed,
  toggleBookmark,
  updateHighlightNote,
  type Drawing,
  type Highlight,
} from "../../db/userdb";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { AnnotatedBody } from "./AnnotatedBody";
import { DrawingCanvas } from "./DrawingCanvas";
import { NoteModal } from "./NoteModal";

const PEN_COLORS = ["#E63946", "#1D3557", "#2A9D8F", "#F4A300", "#6A4C93", "#12181F"];
const PEN_STROKE_WIDTH = 3;

/**
 * Renders one section's title/body/bookmark control. Used both as the whole
 * screen (phone, pushed via navigation) and embedded in the right-hand pane
 * of a tablet SplitView.
 */
export function SectionDetailView({
  id,
  onTitleChange,
  onDrawModeChange,
}: {
  id: string;
  onTitleChange?: (title: string) => void;
  /** Fires whenever draw mode toggles — used to disable swipe-to-go-back while drawing, since the stroke gesture near the screen edge otherwise fights the system back gesture. */
  onDrawModeChange?: (active: boolean) => void;
}) {
  const db = useSQLiteContext();
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [section, setSection] = useState<Section | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [annotateMode, setAnnotateMode] = useState<"highlight" | "note" | null>(null);
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);
  const [newRange, setNewRange] = useState<{ start: number; end: number } | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [findMode, setFindMode] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const contentHeightRef = useRef(0);

  const refreshHighlights = useCallback(async () => {
    setHighlights(await listHighlightsForSection(userDb, id));
  }, [userDb, id]);

  const refreshDrawings = useCallback(async () => {
    setDrawings(await listDrawingsForSection(userDb, id));
  }, [userDb, id]);

  useEffect(() => {
    let cancelled = false;
    setSection(null);
    setAnnotateMode(null);
    setPendingStart(null);
    setDrawMode(false);
    setFindMode(false);
    setFindQuery("");
    (async () => {
      const s = await getSection(db, id);
      if (cancelled || !s) return;
      setSection(s);
      setBookmarked(await isBookmarked(userDb, id));
      setHighlights(await listHighlightsForSection(userDb, id));
      setDrawings(await listDrawingsForSection(userDb, id));
      onTitleChange?.(s.section_number);
      recordRecentlyViewed(userDb, id);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, userDb, id, onTitleChange]);

  const handleStrokeComplete = useCallback(
    (points: [number, number][]) => {
      // Update local state immediately (before the DB round-trip) so the
      // stroke never disappears for a frame between the finger lifting and
      // the async write finishing — see DrawingCanvas's live-stroke handoff.
      const optimistic: Drawing = {
        id: `pending:${Date.now()}`,
        section_id: id,
        color: penColor,
        stroke_width: PEN_STROKE_WIDTH,
        points,
        created_at: Date.now(),
      };
      setDrawings((prev) => [...prev, optimistic]);
      addDrawing(userDb, { sectionId: id, color: penColor, strokeWidth: PEN_STROKE_WIDTH, points }).then(() =>
        refreshDrawings()
      );
    },
    [userDb, id, penColor, refreshDrawings]
  );

  const handleUndoStroke = useCallback(() => {
    const last = drawings[drawings.length - 1];
    if (!last) return;
    setDrawings((prev) => prev.slice(0, -1));
    if (!last.id.startsWith("pending:")) deleteDrawing(userDb, last.id).then(() => refreshDrawings());
  }, [userDb, drawings, refreshDrawings]);

  const handleClearDrawings = useCallback(() => {
    setDrawings([]);
    clearDrawingsForSection(userDb, id).then(() => refreshDrawings());
  }, [userDb, id, refreshDrawings]);

  useEffect(() => {
    onDrawModeChange?.(drawMode);
  }, [drawMode, onDrawModeChange]);

  const handleContentLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width, height });
  }, []);

  // Character offsets of every match of findQuery within the body — this is
  // a "find in this document" search over the single open section, distinct
  // from the app-wide/part-wide search bars on the Parts and Sections list
  // screens.
  const findMatches = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!section || q.length < 2) return [];
    const body = section.body.toLowerCase();
    const offsets: number[] = [];
    let from = 0;
    for (let found = body.indexOf(q, from); found !== -1; found = body.indexOf(q, from)) {
      offsets.push(found);
      from = found + q.length;
    }
    return offsets;
  }, [section, findQuery]);

  const safeMatchIndex = findMatches.length ? currentMatch % findMatches.length : 0;

  useEffect(() => {
    if (!findMode || findMatches.length === 0 || !section) return;
    // Approximate: assumes the match's fraction of the way through the body
    // text lines up with the same fraction of the way down the rendered
    // content. Good enough to bring a match into view without needing exact
    // text-layout measurement.
    const fraction = findMatches[safeMatchIndex] / section.body.length;
    scrollViewRef.current?.scrollTo({ y: fraction * contentHeightRef.current, animated: true });
  }, [findMode, findMatches, safeMatchIndex, section]);

  const goToNextMatch = useCallback(() => setCurrentMatch((i) => i + 1), []);
  const goToPrevMatch = useCallback(
    () => setCurrentMatch((i) => (findMatches.length ? i - 1 + findMatches.length : i)),
    [findMatches.length]
  );

  const handleToggleBookmark = useCallback(async () => {
    const nowBookmarked = await toggleBookmark(userDb, id);
    setBookmarked(nowBookmarked);
  }, [userDb, id]);

  const handleWordPress = useCallback(
    (wordIndex: number) => {
      if (pendingStart == null) {
        setPendingStart(wordIndex);
        return;
      }
      const start = Math.min(pendingStart, wordIndex);
      const end = Math.max(pendingStart, wordIndex);
      setPendingStart(null);

      if (annotateMode === "note") {
        // Notes need text, so open the editor for this range.
        setNewRange({ start, end });
        return;
      }

      // Plain highlight — no note, save immediately, no modal. Stay in
      // highlight mode so multiple passages can be marked in one go.
      addHighlight(userDb, { sectionId: id, startIndex: start, endIndex: end, note: null }).then(refreshHighlights);
    },
    [pendingStart, annotateMode, userDb, id, refreshHighlights]
  );

  const currentMatchSnippet = useMemo(() => {
    if (!section || findMatches.length === 0) return null;
    const offset = findMatches[safeMatchIndex];
    const len = findQuery.trim().length;
    const CONTEXT = 40;
    const start = Math.max(0, offset - CONTEXT);
    const end = Math.min(section.body.length, offset + len + CONTEXT);
    return {
      before: (start > 0 ? "…" : "") + section.body.slice(start, offset),
      match: section.body.slice(offset, offset + len),
      after: section.body.slice(offset + len, end) + (end < section.body.length ? "…" : ""),
    };
  }, [section, findMatches, safeMatchIndex, findQuery]);

  const quotedTextFor = useCallback(
    (start: number, end: number) => {
      if (!section) return "";
      const words = tokenizeBody(section.body).filter((t) => t.wordIndex != null && t.wordIndex >= start && t.wordIndex <= end);
      return words.map((w) => w.text).join(" ");
    },
    [section]
  );

  const handleSaveNewHighlight = useCallback(
    async (note: string) => {
      if (!newRange) return;
      await addHighlight(userDb, {
        sectionId: id,
        startIndex: newRange.start,
        endIndex: newRange.end,
        note: note.trim() ? note.trim() : null,
      });
      setNewRange(null);
      await refreshHighlights();
    },
    [userDb, id, newRange, refreshHighlights]
  );

  const handleSaveEditedHighlight = useCallback(
    async (note: string) => {
      if (!editingHighlight) return;
      await updateHighlightNote(userDb, editingHighlight.id, note.trim() ? note.trim() : null);
      setEditingHighlight(null);
      await refreshHighlights();
    },
    [userDb, editingHighlight, refreshHighlights]
  );

  const handleDeleteHighlight = useCallback(async () => {
    if (!editingHighlight) return;
    await deleteHighlight(userDb, editingHighlight.id);
    setEditingHighlight(null);
    await refreshHighlights();
  }, [userDb, editingHighlight, refreshHighlights]);

  if (!section) return null;

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        onContentSizeChange={(_, height) => {
          contentHeightRef.current = height;
        }}
      >
        <View style={styles.pageArea} onLayout={handleContentLayout}>
          <Text style={styles.path}>{section.path}</Text>
          <Text style={styles.title} selectable>
            {section.title}
          </Text>

          <AnnotatedBody
            body={section.body}
            highlights={highlights}
            annotating={annotateMode != null}
            pendingStart={pendingStart}
            onWordPress={handleWordPress}
          />

          <DrawingCanvas
            width={canvasSize.width}
            height={canvasSize.height}
            drawings={drawings}
            active={drawMode}
            color={penColor}
            strokeWidth={PEN_STROKE_WIDTH}
            onStrokeComplete={handleStrokeComplete}
          />
        </View>

        {highlights.length > 0 && (
          <View style={styles.highlightsSection}>
            <Text style={styles.highlightsHeading}>Your Highlights & Notes</Text>
            {highlights.map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setEditingHighlight(h)}
                style={({ pressed }) => [styles.highlightCard, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.highlightQuote} numberOfLines={3}>
                  “{quotedTextFor(h.start_index, h.end_index)}”
                </Text>
                {h.note?.trim() ? <Text style={styles.highlightNote}>📝 {h.note}</Text> : null}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fixed panel below the ScrollView — never needs scrolling to reach. */}
      <View style={styles.bottomPanel}>
        {annotateMode && (
          <Text style={styles.annotateHint}>
            {pendingStart == null
              ? annotateMode === "note"
                ? "Tap the first word of the passage you want to note."
                : "Tap the first word of the passage you want to highlight."
              : "Now tap the last word of the passage."}
          </Text>
        )}

        {findMode && (
          <View style={styles.findBar}>
            <TextInput
              value={findQuery}
              onChangeText={(t) => {
                setFindQuery(t);
                setCurrentMatch(0);
              }}
              placeholder="Find in this document"
              placeholderTextColor={colors.textMuted}
              style={styles.findInput}
              autoFocus
            />
            {findQuery.trim().length >= 2 && (
              <View style={styles.findControls}>
                <Text style={styles.findCount}>
                  {findMatches.length ? `${safeMatchIndex + 1} of ${findMatches.length}` : "No matches"}
                </Text>
                <View style={{ flex: 1 }} />
                <Pressable onPress={goToPrevMatch} disabled={!findMatches.length} hitSlop={8}>
                  <Text style={[styles.findNav, !findMatches.length && styles.findNavDisabled]}>‹</Text>
                </Pressable>
                <Pressable onPress={goToNextMatch} disabled={!findMatches.length} hitSlop={8}>
                  <Text style={[styles.findNav, !findMatches.length && styles.findNavDisabled]}>›</Text>
                </Pressable>
              </View>
            )}
            {currentMatchSnippet && (
              <Text style={styles.findSnippet} numberOfLines={2}>
                {currentMatchSnippet.before}
                <Text style={styles.findSnippetMatch}>{currentMatchSnippet.match}</Text>
                {currentMatchSnippet.after}
              </Text>
            )}
          </View>
        )}

        {drawMode && (
          <View style={styles.penBar}>
            {PEN_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setPenColor(c)}
                style={[styles.swatch, { backgroundColor: c }, c === penColor && styles.swatchSelected]}
              />
            ))}
            <View style={{ flex: 1 }} />
            <Pressable onPress={handleUndoStroke} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={styles.penBarButtonText}>Undo</Text>
            </Pressable>
            <Pressable onPress={handleClearDrawings} style={({ pressed }) => pressed && { opacity: 0.6 }}>
              <Text style={[styles.penBarButtonText, styles.clearText]}>Clear</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.toolbar}>
          <Pressable
            onPress={handleToggleBookmark}
            style={({ pressed }) => [styles.toolbarButton, bookmarked && styles.toolbarButtonActive, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.toolbarIcon, bookmarked && styles.toolbarIconActive]}>{bookmarked ? "★" : "☆"}</Text>
            <Text style={[styles.toolbarLabel, bookmarked && styles.toolbarLabelActive]}>Bookmark</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setAnnotateMode((m) => (m === "highlight" ? null : "highlight"));
              setPendingStart(null);
              setDrawMode(false);
              setFindMode(false);
            }}
            style={({ pressed }) => [
              styles.toolbarButton,
              annotateMode === "highlight" && styles.toolbarButtonActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.toolbarIcon, annotateMode === "highlight" && styles.toolbarIconActive]}>🖍️</Text>
            <Text style={[styles.toolbarLabel, annotateMode === "highlight" && styles.toolbarLabelActive]}>Highlight</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setAnnotateMode((m) => (m === "note" ? null : "note"));
              setPendingStart(null);
              setDrawMode(false);
              setFindMode(false);
            }}
            style={({ pressed }) => [
              styles.toolbarButton,
              annotateMode === "note" && styles.toolbarButtonActive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.toolbarIcon, annotateMode === "note" && styles.toolbarIconActive]}>📝</Text>
            <Text style={[styles.toolbarLabel, annotateMode === "note" && styles.toolbarLabelActive]}>Note</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setDrawMode((d) => !d);
              setAnnotateMode(null);
              setPendingStart(null);
              setFindMode(false);
            }}
            style={({ pressed }) => [styles.toolbarButton, drawMode && styles.toolbarButtonActive, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.toolbarIcon, drawMode && styles.toolbarIconActive]}>🖊</Text>
            <Text style={[styles.toolbarLabel, drawMode && styles.toolbarLabelActive]}>Draw</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setFindMode((f) => !f);
              setAnnotateMode(null);
              setPendingStart(null);
              setDrawMode(false);
            }}
            style={({ pressed }) => [styles.toolbarButton, findMode && styles.toolbarButtonActive, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.toolbarIcon, findMode && styles.toolbarIconActive]}>🔍</Text>
            <Text style={[styles.toolbarLabel, findMode && styles.toolbarLabelActive]}>Find</Text>
          </Pressable>
        </View>
      </View>

      <NoteModal
        visible={newRange != null}
        quotedText={newRange ? quotedTextFor(newRange.start, newRange.end) : ""}
        initialNote=""
        onSave={handleSaveNewHighlight}
        onCancel={() => setNewRange(null)}
      />

      <NoteModal
        visible={editingHighlight != null}
        quotedText={editingHighlight ? quotedTextFor(editingHighlight.start_index, editingHighlight.end_index) : ""}
        initialNote={editingHighlight?.note ?? ""}
        onSave={handleSaveEditedHighlight}
        onDelete={handleDeleteHighlight}
        onCancel={() => setEditingHighlight(null)}
      />
    </View>
  );
}

export function SectionDetailPlaceholder({ message }: { message: string }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(3) },
    pageArea: { position: "relative" },
    path: { fontSize: 12 * fontScale, color: colors.textMuted, marginBottom: spacing(1) },
    title: { fontSize: 22 * fontScale, fontWeight: "800", color: colors.text, marginBottom: spacing(2) },
    highlightsSection: { marginTop: spacing(3) },
    highlightsHeading: {
      fontSize: 13 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginBottom: spacing(1),
    },
    highlightCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.5),
      marginBottom: spacing(1),
    },
    highlightQuote: { fontSize: 14 * fontScale, fontStyle: "italic", color: colors.text },
    highlightNote: { fontSize: 14 * fontScale, color: colors.primary, marginTop: spacing(0.75) },
    annotateHint: {
      fontSize: 13 * fontScale,
      color: colors.primary,
      fontStyle: "italic",
      textAlign: "center",
      paddingTop: spacing(1),
    },
    penBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing(1.25),
      padding: spacing(1.25),
      backgroundColor: colors.surface,
    },
    swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "transparent" },
    swatchSelected: { borderColor: colors.text },
    penBarButtonText: { color: colors.primary, fontWeight: "700", marginLeft: spacing(1.5), fontSize: 15 * fontScale },
    clearText: { color: colors.danger },
    findBar: { padding: spacing(1.25), backgroundColor: colors.surface },
    findInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(1),
      fontSize: 15 * fontScale,
      color: colors.text,
      backgroundColor: colors.background,
    },
    findControls: { flexDirection: "row", alignItems: "center", marginTop: spacing(1) },
    findCount: { fontSize: 13 * fontScale, color: colors.textMuted },
    findNav: { fontSize: 24 * fontScale, color: colors.primary, fontWeight: "700", paddingHorizontal: spacing(1) },
    findNavDisabled: { color: colors.border },
    findSnippet: { fontSize: 13 * fontScale, color: colors.textMuted, marginTop: spacing(1) },
    findSnippetMatch: { color: colors.text, fontWeight: "700", backgroundColor: "#FFF3B0" },
    bottomPanel: {
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    toolbar: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    toolbarButton: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing(1.25),
    },
    toolbarButtonActive: { backgroundColor: colors.surface },
    toolbarIcon: { fontSize: 22 * fontScale, color: colors.textMuted },
    toolbarIconActive: { color: colors.primary },
    toolbarLabel: { fontSize: 11 * fontScale, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
    toolbarLabelActive: { color: colors.primary },
    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      padding: spacing(3),
    },
    placeholderText: { color: colors.textMuted, fontSize: 15 * fontScale, textAlign: "center" },
  });
}

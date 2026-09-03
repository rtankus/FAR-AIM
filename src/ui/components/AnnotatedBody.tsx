import { useMemo, type ReactNode } from "react";
import { Text, TextInput } from "react-native";
import { tokenizeBody } from "../../content/tokenize";
import type { Highlight } from "../../db/userdb";
import { useTheme } from "../ThemeContext";

interface RenderToken {
  text: string;
  wordIndex: number | null;
  highlight: Highlight | null;
}

function buildRenderTokens(body: string, highlights: Highlight[]): RenderToken[] {
  const highlightByWord = new Map<number, Highlight>();
  for (const h of highlights) {
    for (let i = h.start_index; i <= h.end_index; i++) highlightByWord.set(i, h);
  }
  return tokenizeBody(body).map((t) => ({
    text: t.text,
    wordIndex: t.wordIndex,
    highlight: t.wordIndex != null ? highlightByWord.get(t.wordIndex) ?? null : null,
  }));
}

/**
 * Renders a section body.
 *
 * Reading mode is a read-only <TextInput> (editable={false}), not <Text> —
 * plain RN <Text selectable> only supports "long-press to select the whole
 * block", never a partial drag-selection; a UITextView (what TextInput is
 * backed by on iOS) is what actually gives tap-to-place-cursor, drag
 * handles, and word-by-word extension. The trade-off is TextInput can't
 * rich-style substrings, so highlighted passages aren't colored inline
 * here — see the "Your Highlights & Notes" list below the body instead
 * (SectionDetailView).
 *
 * Picking a new highlight/note range is a separate concern (tapping a
 * specific word to set start/end) that TextInput can't do either, so that
 * mode still renders a run of individually-tappable word spans.
 */
export function AnnotatedBody({
  body,
  highlights,
  annotating,
  pendingStart,
  onWordPress,
}: {
  body: string;
  highlights: Highlight[];
  annotating: boolean;
  pendingStart: number | null;
  onWordPress: (wordIndex: number) => void;
}) {
  const { colors, fontScale } = useTheme();
  const bodyStyle = { fontSize: 17 * fontScale, lineHeight: 26 * fontScale, color: colors.text };
  const tokens = useMemo(() => buildRenderTokens(body, highlights), [body, highlights]);

  if (!annotating) {
    return (
      <TextInput
        value={body}
        editable={false}
        multiline
        scrollEnabled={false}
        style={[bodyStyle, { padding: 0 }]}
      />
    );
  }

  const highlightedStyle = { backgroundColor: "#FFF3B0", color: "#12181F" };
  const noteSpanStyle = { backgroundColor: "#CFE8FF", color: "#0B3B66" };
  const pendingAnchorStyle = { backgroundColor: colors.primary, color: "#fff" };
  const nodes: ReactNode[] = tokens.map((tok, i) => {
    const isPendingAnchor = pendingStart != null && tok.wordIndex === pendingStart;
    const noted = !!tok.highlight?.note?.trim();
    const style = [tok.highlight && (noted ? noteSpanStyle : highlightedStyle), isPendingAnchor && pendingAnchorStyle];
    if (tok.wordIndex != null) {
      return (
        <Text key={i} style={style} onPress={() => onWordPress(tok.wordIndex!)}>
          {tok.text}
        </Text>
      );
    }
    return (
      <Text key={i} style={style}>
        {tok.text}
      </Text>
    );
  });

  return <Text style={bodyStyle}>{nodes}</Text>;
}

import { useMemo, type ReactNode } from "react";
import { Text } from "react-native";
import { tokenizeBody } from "../../content/tokenize";
import type { Highlight } from "../../db/userdb";
import { useTheme } from "../ThemeContext";

interface RenderToken {
  text: string;
  wordIndex: number | null;
  highlight: Highlight | null;
}

interface Run {
  text: string;
  highlight: Highlight | null;
}

function hasNote(h: Highlight | null): boolean {
  return !!h?.note?.trim();
}

function buildRenderTokens(body: string, highlights: Highlight[]): RenderToken[] {
  const highlightByWord = new Map<number, Highlight>();
  for (const h of highlights) {
    for (let i = h.start_index; i <= h.end_index; i++) highlightByWord.set(i, h);
  }

  const tokens: RenderToken[] = tokenizeBody(body).map((t) => ({
    text: t.text,
    wordIndex: t.wordIndex,
    highlight: t.wordIndex != null ? highlightByWord.get(t.wordIndex) ?? null : null,
  }));

  // Fill whitespace runs that sit between two words sharing the same
  // highlight, so the highlight background reads as one continuous span.
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].wordIndex != null) continue;
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    if (prev?.highlight && prev.highlight.id === next?.highlight?.id) {
      tokens[i].highlight = prev.highlight;
    }
  }

  return tokens;
}

// Collapses runs of tokens that share the same highlight (or share "no
// highlight") into a single string each. Word-by-word tokens are only
// needed to support tapping a specific word while picking a range; outside
// of that, splitting the body into one <Text> per word is what breaks
// iOS's normal drag-to-select-a-range gesture (it only grabs "everything"
// across many sibling <Text> nodes). Merging back down to one run per
// highight boundary — one run for the *whole* body when there are no
// highlights at all — restores normal partial selection/copy.
function buildRuns(tokens: RenderToken[]): Run[] {
  const runs: Run[] = [];
  for (const tok of tokens) {
    const last = runs[runs.length - 1];
    const sameGroup = last && (last.highlight?.id ?? null) === (tok.highlight?.id ?? null);
    if (sameGroup) {
      last.text += tok.text;
    } else {
      runs.push({ text: tok.text, highlight: tok.highlight });
    }
  }
  return runs;
}

/**
 * Renders a section body. While picking a new highlight/note range, it's a
 * run of individually-tappable word spans. Otherwise it's merged back down
 * to one <Text> per highlight boundary (see buildRuns) so normal text
 * selection/copy works everywhere except across a highlight — plain
 * highlights sit there in yellow, note-bearing ones additionally show their
 * note text inline right after the passage (no tap needed to read it), and
 * tapping either opens it for editing.
 */
export function AnnotatedBody({
  body,
  highlights,
  annotating,
  pendingStart,
  onWordPress,
  onHighlightPress,
}: {
  body: string;
  highlights: Highlight[];
  annotating: boolean;
  pendingStart: number | null;
  onWordPress: (wordIndex: number) => void;
  onHighlightPress: (highlightId: string) => void;
}) {
  const { colors, fontScale } = useTheme();
  const tokens = useMemo(() => buildRenderTokens(body, highlights), [body, highlights]);
  const runs = useMemo(() => buildRuns(tokens), [tokens]);
  const bodyStyle = { fontSize: 17 * fontScale, lineHeight: 26 * fontScale, color: colors.text };
  const highlightedStyle = { backgroundColor: "#FFF3B0", color: "#12181F" };
  const noteSpanStyle = { backgroundColor: "#CFE8FF", color: "#0B3B66" };
  const noteInlineStyle = { fontSize: 14 * fontScale, fontStyle: "italic" as const, color: colors.primary };
  const pendingAnchorStyle = { backgroundColor: colors.primary, color: "#fff" };

  const nodes: ReactNode[] = [];

  if (annotating) {
    tokens.forEach((tok, i) => {
      const isPendingAnchor = pendingStart != null && tok.wordIndex === pendingStart;
      const noted = hasNote(tok.highlight);
      const style = [tok.highlight && (noted ? noteSpanStyle : highlightedStyle), isPendingAnchor && pendingAnchorStyle];
      if (tok.wordIndex != null) {
        nodes.push(
          <Text key={i} style={style} onPress={() => onWordPress(tok.wordIndex!)}>
            {tok.text}
          </Text>
        );
      } else {
        nodes.push(
          <Text key={i} style={style}>
            {tok.text}
          </Text>
        );
      }
    });
  } else {
    runs.forEach((run, i) => {
      const noted = hasNote(run.highlight);
      if (!run.highlight) {
        nodes.push(<Text key={i}>{run.text}</Text>);
        return;
      }
      const h = run.highlight;
      nodes.push(
        <Text key={i} style={noted ? noteSpanStyle : highlightedStyle} onPress={() => onHighlightPress(h.id)}>
          {run.text}
        </Text>
      );
      if (noted) {
        nodes.push(
          <Text key={`${i}-note`} style={noteInlineStyle}>
            {" "}
            📝 {h.note}
          </Text>
        );
      }
    });
  }

  return (
    <Text style={bodyStyle} selectable={!annotating}>
      {nodes}
    </Text>
  );
}

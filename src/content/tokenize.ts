/**
 * Splits a section body into whitespace and word tokens so it can be
 * rendered as a run of individually-tappable <Text> spans (needed for
 * word-range highlighting — RN's Text has no selection-range API to hook
 * into, so tap-to-pick-a-word-range is the fallback).
 *
 * Word indices only count non-whitespace tokens and are stable for a given
 * body string — that's what highlight rows store as start/end. If the
 * underlying section body ever changes (a content update editing wording),
 * previously-saved word indices for that section may point at the wrong
 * words; that's an accepted limitation, not handled here.
 */
export interface BodyToken {
  text: string;
  /** Index among word tokens only, or null for a whitespace token. */
  wordIndex: number | null;
}

export function tokenizeBody(body: string): BodyToken[] {
  const parts = body.split(/(\s+)/);
  let wordIndex = 0;
  return parts
    .filter((text) => text.length > 0)
    .map((text) => {
      if (/^\s+$/.test(text)) return { text, wordIndex: null };
      return { text, wordIndex: wordIndex++ };
    });
}

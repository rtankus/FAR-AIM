import { useCallback, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import type { Section, Source } from "../../content/types";
import { searchSections } from "../../db/queries";

/**
 * Backs an inline search bar scoped to whatever's currently browsed into —
 * every source (Parts screen), or one source + part (Sections screen).
 * Pass source/part as plain values (not an object) so the callback's
 * dependency array stays stable across renders.
 */
export function useSectionSearch(db: SQLiteDatabase, source?: Source, part?: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Section[]>([]);

  const onChangeQuery = useCallback(
    (text: string) => {
      setQuery(text);
      if (text.trim().length < 2) {
        setResults([]);
        return;
      }
      searchSections(db, text, { source, part }).then(setResults);
    },
    [db, source, part]
  );

  return { query, results, onChangeQuery, active: query.trim().length >= 2 };
}

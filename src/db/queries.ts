import type { SQLiteDatabase } from "expo-sqlite";
import type { PartSummary, Section, Source } from "../content/types";

export async function listParts(db: SQLiteDatabase, source: Source): Promise<PartSummary[]> {
  return db.getAllAsync<PartSummary>(
    `SELECT part, COUNT(*) as count FROM sections
     WHERE source = ? GROUP BY part ORDER BY sort_order`,
    [source]
  );
}

export async function listSectionsInPart(
  db: SQLiteDatabase,
  source: Source,
  part: string
): Promise<Section[]> {
  return db.getAllAsync<Section>(
    `SELECT * FROM sections WHERE source = ? AND part = ? ORDER BY sort_order`,
    [source, part]
  );
}

export async function getSection(db: SQLiteDatabase, id: string): Promise<Section | null> {
  return db.getFirstAsync<Section>(`SELECT * FROM sections WHERE id = ?`, [id]);
}

/** Fetches sections by id, preserving the order of `ids` (e.g. bookmark or recency order). */
export async function getSectionsByIds(db: SQLiteDatabase, ids: string[]): Promise<Section[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await db.getAllAsync<Section>(
    `SELECT * FROM sections WHERE id IN (${placeholders})`,
    ids
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((s): s is Section => s != null);
}

/**
 * Full-text search, optionally scoped to a source (e.g. just AC) and/or a
 * part within it (e.g. just Part 61) — used to let the search bar on the
 * Parts/Sections list screens search only what's currently browsed into,
 * rather than always searching everything.
 */
export async function searchSections(
  db: SQLiteDatabase,
  query: string,
  opts: { source?: Source; part?: string; limit?: number } = {}
): Promise<Section[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  // Wrap each search term in quotes and OR them so partial/multi-word
  // queries degrade gracefully instead of erroring on FTS5 syntax chars.
  const ftsQuery = trimmed
    .split(/\s+/)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(" OR ");

  const conditions = ["sections_fts MATCH ?"];
  const params: (string | number)[] = [ftsQuery];
  if (opts.source) {
    conditions.push("s.source = ?");
    params.push(opts.source);
  }
  if (opts.part) {
    conditions.push("s.part = ?");
    params.push(opts.part);
  }
  params.push(opts.limit ?? 50);

  return db.getAllAsync<Section>(
    `SELECT s.* FROM sections_fts f
     JOIN sections s ON s.rowid = f.rowid
     WHERE ${conditions.join(" AND ")}
     ORDER BY rank LIMIT ?`,
    params
  );
}

export async function countSectionsBySource(db: SQLiteDatabase, source: Source): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM sections WHERE source = ?`,
    [source]
  );
  return row?.count ?? 0;
}

/** The Nth section for a source, in the same stable order used for browsing. */
export async function getSectionAtOffset(
  db: SQLiteDatabase,
  source: Source,
  offset: number
): Promise<Section | null> {
  return db.getFirstAsync<Section>(
    `SELECT * FROM sections WHERE source = ? ORDER BY sort_order LIMIT 1 OFFSET ?`,
    [source, offset]
  );
}

// Bookmarks, recently-viewed, and highlights/notes live in a separate
// user-only database now — see ../db/userdb.ts — so they survive content
// updates, which replace this database's file wholesale.

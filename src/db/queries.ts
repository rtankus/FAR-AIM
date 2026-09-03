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

export async function searchSections(
  db: SQLiteDatabase,
  query: string,
  limit = 50
): Promise<Section[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  // Wrap each search term in quotes and OR them so partial/multi-word
  // queries degrade gracefully instead of erroring on FTS5 syntax chars.
  const ftsQuery = trimmed
    .split(/\s+/)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(" OR ");
  return db.getAllAsync<Section>(
    `SELECT s.* FROM sections_fts f
     JOIN sections s ON s.rowid = f.rowid
     WHERE sections_fts MATCH ?
     ORDER BY rank LIMIT ?`,
    [ftsQuery, limit]
  );
}

// Bookmarks, recently-viewed, and highlights/notes live in a separate
// user-only database now — see ../db/userdb.ts — so they survive content
// updates, which replace this database's file wholesale.

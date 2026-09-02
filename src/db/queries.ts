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

export async function isBookmarked(db: SQLiteDatabase, sectionId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ section_id: string }>(
    `SELECT section_id FROM bookmarks WHERE section_id = ?`,
    [sectionId]
  );
  return row != null;
}

export async function toggleBookmark(db: SQLiteDatabase, sectionId: string): Promise<boolean> {
  const bookmarked = await isBookmarked(db, sectionId);
  if (bookmarked) {
    await db.runAsync(`DELETE FROM bookmarks WHERE section_id = ?`, [sectionId]);
    return false;
  }
  await db.runAsync(`INSERT INTO bookmarks (section_id, created_at) VALUES (?, ?)`, [
    sectionId,
    Date.now(),
  ]);
  return true;
}

export async function listBookmarkedSections(db: SQLiteDatabase): Promise<Section[]> {
  return db.getAllAsync<Section>(
    `SELECT s.* FROM bookmarks b
     JOIN sections s ON s.id = b.section_id
     ORDER BY b.created_at DESC`
  );
}

export async function recordRecentlyViewed(db: SQLiteDatabase, sectionId: string): Promise<void> {
  await db.runAsync(`INSERT INTO recently_viewed (section_id, viewed_at) VALUES (?, ?)`, [
    sectionId,
    Date.now(),
  ]);
  // Keep the table from growing unbounded.
  await db.runAsync(
    `DELETE FROM recently_viewed WHERE rowid NOT IN (
       SELECT rowid FROM recently_viewed ORDER BY viewed_at DESC LIMIT 200
     )`
  );
}

export async function listRecentlyViewed(db: SQLiteDatabase, limit = 20): Promise<Section[]> {
  return db.getAllAsync<Section>(
    `SELECT s.*, MAX(r.viewed_at) as last_viewed FROM recently_viewed r
     JOIN sections s ON s.id = r.section_id
     GROUP BY s.id
     ORDER BY last_viewed DESC LIMIT ?`,
    [limit]
  );
}

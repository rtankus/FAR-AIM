import type { SQLiteDatabase } from "expo-sqlite";

// A separate, local-only database for anything the *user* creates —
// bookmarks, recently-viewed, and highlights/notes. It is never touched by
// content updates (see database.ts), which replace the shipped FAR/AIM
// content bundle wholesale. Keeping user data in its own file means a
// content update can never wipe it.
export const USER_DB_NAME = "faraim-userdata.db";

export interface Drawing {
  id: string;
  section_id: string;
  color: string;
  stroke_width: number;
  /** Points in the section's content coordinate space, as [x, y] pairs. */
  points: [number, number][];
  created_at: number;
}

export interface Highlight {
  id: string;
  section_id: string;
  start_index: number;
  end_index: number;
  note: string | null;
  created_at: number;
  updated_at: number;
}

export async function initUserDb(userDb: SQLiteDatabase): Promise<void> {
  await userDb.execAsync(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      section_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recently_viewed (
      section_id TEXT NOT NULL,
      viewed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      start_index INTEGER NOT NULL,
      end_index INTEGER NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_highlights_section ON highlights(section_id);

    CREATE TABLE IF NOT EXISTS drawings (
      id TEXT PRIMARY KEY,
      section_id TEXT NOT NULL,
      color TEXT NOT NULL,
      stroke_width REAL NOT NULL,
      points TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_drawings_section ON drawings(section_id);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/**
 * One-time migration for installs that already had bookmarks/recently-viewed
 * saved in the old location (the content database, which used to carry
 * those tables until this file existed). Safe to call on every launch —
 * it's a no-op once the migration flag is set, and tolerates the legacy
 * tables not existing (fresh installs, or a content bundle built after
 * they were dropped from the content-pipeline schema).
 */
export async function migrateLegacyUserData(
  userDb: SQLiteDatabase,
  contentDb: SQLiteDatabase
): Promise<void> {
  const done = await userDb.getFirstAsync<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'migrated_legacy_user_data'`
  );
  if (done) return;

  try {
    const legacyBookmarks = await contentDb.getAllAsync<{ section_id: string; created_at: number }>(
      `SELECT section_id, created_at FROM bookmarks`
    );
    for (const row of legacyBookmarks) {
      await userDb.runAsync(
        `INSERT OR IGNORE INTO bookmarks (section_id, created_at) VALUES (?, ?)`,
        [row.section_id, row.created_at]
      );
    }
  } catch {
    // Legacy table doesn't exist on this content bundle — nothing to migrate.
  }

  try {
    const legacyRecent = await contentDb.getAllAsync<{ section_id: string; viewed_at: number }>(
      `SELECT section_id, viewed_at FROM recently_viewed`
    );
    for (const row of legacyRecent) {
      await userDb.runAsync(
        `INSERT INTO recently_viewed (section_id, viewed_at) VALUES (?, ?)`,
        [row.section_id, row.viewed_at]
      );
    }
  } catch {
    // Legacy table doesn't exist on this content bundle — nothing to migrate.
  }

  await userDb.runAsync(
    `INSERT OR REPLACE INTO meta (key, value) VALUES ('migrated_legacy_user_data', '1')`
  );
}

export async function getSetting(userDb: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await userDb.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export async function setSetting(userDb: SQLiteDatabase, key: string, value: string): Promise<void> {
  await userDb.runAsync(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, [key, value]);
}

export async function isBookmarked(userDb: SQLiteDatabase, sectionId: string): Promise<boolean> {
  const row = await userDb.getFirstAsync<{ section_id: string }>(
    `SELECT section_id FROM bookmarks WHERE section_id = ?`,
    [sectionId]
  );
  return row != null;
}

export async function toggleBookmark(userDb: SQLiteDatabase, sectionId: string): Promise<boolean> {
  const bookmarked = await isBookmarked(userDb, sectionId);
  if (bookmarked) {
    await userDb.runAsync(`DELETE FROM bookmarks WHERE section_id = ?`, [sectionId]);
    return false;
  }
  await userDb.runAsync(`INSERT INTO bookmarks (section_id, created_at) VALUES (?, ?)`, [
    sectionId,
    Date.now(),
  ]);
  return true;
}

/** Bookmarked section ids, most-recently-bookmarked first. */
export async function listBookmarkedSectionIds(userDb: SQLiteDatabase): Promise<string[]> {
  const rows = await userDb.getAllAsync<{ section_id: string }>(
    `SELECT section_id FROM bookmarks ORDER BY created_at DESC`
  );
  return rows.map((r) => r.section_id);
}

export async function recordRecentlyViewed(userDb: SQLiteDatabase, sectionId: string): Promise<void> {
  await userDb.runAsync(`INSERT INTO recently_viewed (section_id, viewed_at) VALUES (?, ?)`, [
    sectionId,
    Date.now(),
  ]);
  // Keep the table from growing unbounded.
  await userDb.runAsync(
    `DELETE FROM recently_viewed WHERE rowid NOT IN (
       SELECT rowid FROM recently_viewed ORDER BY viewed_at DESC LIMIT 200
     )`
  );
}

/** Recently-viewed section ids, most-recent first (de-duplicated). */
export async function listRecentlyViewedSectionIds(
  userDb: SQLiteDatabase,
  limit = 20
): Promise<string[]> {
  const rows = await userDb.getAllAsync<{ section_id: string }>(
    `SELECT section_id, MAX(viewed_at) as last_viewed FROM recently_viewed
     GROUP BY section_id ORDER BY last_viewed DESC LIMIT ?`,
    [limit]
  );
  return rows.map((r) => r.section_id);
}

export async function listHighlightsForSection(
  userDb: SQLiteDatabase,
  sectionId: string
): Promise<Highlight[]> {
  return userDb.getAllAsync<Highlight>(
    `SELECT * FROM highlights WHERE section_id = ? ORDER BY start_index`,
    [sectionId]
  );
}

export async function addHighlight(
  userDb: SQLiteDatabase,
  params: { sectionId: string; startIndex: number; endIndex: number; note: string | null }
): Promise<Highlight> {
  const id = `${params.sectionId}:${params.startIndex}-${params.endIndex}:${Date.now()}`;
  const now = Date.now();
  await userDb.runAsync(
    `INSERT INTO highlights (id, section_id, start_index, end_index, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, params.sectionId, params.startIndex, params.endIndex, params.note, now, now]
  );
  return {
    id,
    section_id: params.sectionId,
    start_index: params.startIndex,
    end_index: params.endIndex,
    note: params.note,
    created_at: now,
    updated_at: now,
  };
}

export async function updateHighlightNote(
  userDb: SQLiteDatabase,
  id: string,
  note: string | null
): Promise<void> {
  await userDb.runAsync(`UPDATE highlights SET note = ?, updated_at = ? WHERE id = ?`, [
    note,
    Date.now(),
    id,
  ]);
}

export async function deleteHighlight(userDb: SQLiteDatabase, id: string): Promise<void> {
  await userDb.runAsync(`DELETE FROM highlights WHERE id = ?`, [id]);
}

export async function listDrawingsForSection(
  userDb: SQLiteDatabase,
  sectionId: string
): Promise<Drawing[]> {
  const rows = await userDb.getAllAsync<{
    id: string;
    section_id: string;
    color: string;
    stroke_width: number;
    points: string;
    created_at: number;
  }>(`SELECT * FROM drawings WHERE section_id = ? ORDER BY created_at`, [sectionId]);
  return rows.map((r) => ({ ...r, points: JSON.parse(r.points) }));
}

export async function addDrawing(
  userDb: SQLiteDatabase,
  params: { sectionId: string; color: string; strokeWidth: number; points: [number, number][] }
): Promise<Drawing> {
  const id = `${params.sectionId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  await userDb.runAsync(
    `INSERT INTO drawings (id, section_id, color, stroke_width, points, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.sectionId, params.color, params.strokeWidth, JSON.stringify(params.points), now]
  );
  return {
    id,
    section_id: params.sectionId,
    color: params.color,
    stroke_width: params.strokeWidth,
    points: params.points,
    created_at: now,
  };
}

export async function deleteDrawing(userDb: SQLiteDatabase, id: string): Promise<void> {
  await userDb.runAsync(`DELETE FROM drawings WHERE id = ?`, [id]);
}

export async function clearDrawingsForSection(userDb: SQLiteDatabase, sectionId: string): Promise<void> {
  await userDb.runAsync(`DELETE FROM drawings WHERE section_id = ?`, [sectionId]);
}

/** All section ids that have at least one note-bearing highlight, most-recently-updated first. */
export async function listAnnotatedSectionIds(userDb: SQLiteDatabase): Promise<string[]> {
  const rows = await userDb.getAllAsync<{ section_id: string }>(
    `SELECT section_id, MAX(updated_at) as last_updated FROM highlights
     WHERE note IS NOT NULL AND TRIM(note) != ''
     GROUP BY section_id ORDER BY last_updated DESC`
  );
  return rows.map((r) => r.section_id);
}

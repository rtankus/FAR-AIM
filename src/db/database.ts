import * as SQLite from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import { CONTENT_MANIFEST_URL } from "../config";
import type { ContentManifest } from "../content/types";

export const DB_NAME = "faraim.db";

// The database this app ships with (assets/content/faraim.db), imported into
// the SQLite directory on first launch by <SQLiteProvider assetSource>.
// Metro treats it as a binary asset because of metro.config.js.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const bundledDbAsset = require("../../assets/content/faraim.db");
export const bundledManifest: ContentManifest = require("../../assets/content/manifest.json");

function dbFile(): File {
  return new File(SQLite.defaultDatabaseDirectory, DB_NAME);
}

/** Reads the content_version/built_at rows out of the currently-open database. */
export async function getInstalledVersion(db: SQLite.SQLiteDatabase): Promise<{
  version: string;
  builtAt: string;
} | null> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT key, value FROM meta"
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.content_version) return null;
  return { version: map.content_version, builtAt: map.built_at };
}

/** Fetches the remote manifest (requires network) to see if a newer content bundle exists. */
export async function fetchRemoteManifest(): Promise<ContentManifest> {
  const res = await fetch(CONTENT_MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch content manifest: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  installedVersion: string | null;
  remoteManifest: ContentManifest;
}

export async function checkForContentUpdate(
  db: SQLite.SQLiteDatabase
): Promise<UpdateCheckResult> {
  const [installed, remoteManifest] = await Promise.all([
    getInstalledVersion(db),
    fetchRemoteManifest(),
  ]);
  return {
    updateAvailable: !installed || installed.version !== remoteManifest.version,
    installedVersion: installed?.version ?? null,
    remoteManifest,
  };
}

/**
 * Downloads the new database bundle to a temp file. Safe to call while the
 * current SQLiteDatabase connection is still open — nothing here touches the
 * live database file, so a network failure at this stage leaves the app
 * fully usable.
 */
export async function downloadContentUpdate(
  manifest: ContentManifest,
  onProgress?: (fractionDownloaded: number) => void
): Promise<File> {
  const tempFile = new File(Paths.cache, "faraim-update.db");
  if (tempFile.exists) tempFile.delete();

  await File.downloadFileAsync(manifest.downloadUrl, tempFile, {
    idempotent: true,
    onProgress: onProgress
      ? (data) => {
          if (data.totalBytes > 0) onProgress(data.bytesWritten / data.totalBytes);
        }
      : undefined,
  });

  return tempFile;
}

/**
 * Swaps the already-downloaded database bundle in place of the current one.
 * The caller MUST close its existing SQLiteDatabase connection (db.closeAsync())
 * before calling this, and reopen (or remount <SQLiteProvider>) after it
 * settles — including on failure, since the old file may already be gone.
 */
export async function applyDownloadedContentUpdate(tempFile: File): Promise<void> {
  const target = dbFile();
  if (target.exists) target.delete();
  // WAL sidecar files, if present, are stale once we replace the main file.
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = new File(SQLite.defaultDatabaseDirectory, DB_NAME + suffix);
    if (sidecar.exists) sidecar.delete();
  }

  tempFile.move(new Directory(SQLite.defaultDatabaseDirectory));
  // move() renames in place using the source filename, so rename to DB_NAME.
  const movedFile = new File(SQLite.defaultDatabaseDirectory, "faraim-update.db");
  if (movedFile.exists) {
    movedFile.move(target);
  }
}

import * as SQLite from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { CONTENT_MANIFEST_URL } from "../config";
import type { AirportsManifest } from "../airports/types";

export const AIRPORTS_DB_NAME = "airports.db";

// The db this app ships with (assets/airports/airports.db), built by
// airports-pipeline/ from FAA CIFP + OurAirports. Kept separate from
// faraim.db (see database.ts) since it updates on the FAA's ~28-day AIRAC
// cycle, not weekly with FAR/AIM text — bundling it in would force a
// re-download of a much bigger file on every content refresh.
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const bundledAirportsDbAsset = require("../../assets/airports/airports.db");

// Mirrors CONTENT_MANIFEST_URL's shape, one path segment over — published by
// .github/workflows/update-airports.yml to a rolling "airports-latest"
// release. Keep the repo slug in sync with config.ts's.
export const AIRPORTS_MANIFEST_URL = CONTENT_MANIFEST_URL.replace("content-latest", "airports-latest");

function dbFile(): File {
  return new File(SQLite.defaultDatabaseDirectory, AIRPORTS_DB_NAME);
}

/**
 * Copies the bundled airports.db into the SQLite directory on first launch —
 * the same asset-copy step <SQLiteProvider assetSource> does automatically
 * for faraim.db, done by hand here so opening this second db doesn't require
 * nesting another <SQLiteProvider> (which would shadow useSQLiteContext()
 * for faraim.db elsewhere in the tree — see AirportsDbContext.tsx).
 */
export async function ensureAirportsDbInstalled(): Promise<void> {
  const target = dbFile();
  if (target.exists) return;
  const asset = Asset.fromModule(bundledAirportsDbAsset);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("Bundled airports.db asset has no local URI after download.");
  new File(asset.localUri).copy(target);
}

/** Reads the data_version/built_at rows out of the currently-open airports db. */
export async function getInstalledAirportsVersion(
  db: SQLite.SQLiteDatabase
): Promise<{ version: string; builtAt: string } | null> {
  const rows = await db.getAllAsync<{ key: string; value: string }>("SELECT key, value FROM meta");
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.data_version) return null;
  return { version: map.data_version, builtAt: map.built_at };
}

/** Fetches the remote manifest (requires network) to see if a newer airports bundle exists. */
export async function fetchRemoteAirportsManifest(): Promise<AirportsManifest> {
  const res = await fetch(AIRPORTS_MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch airports manifest: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface AirportsUpdateCheckResult {
  updateAvailable: boolean;
  installedVersion: string | null;
  remoteManifest: AirportsManifest;
}

export async function checkForAirportsUpdate(db: SQLite.SQLiteDatabase): Promise<AirportsUpdateCheckResult> {
  const [installed, remoteManifest] = await Promise.all([
    getInstalledAirportsVersion(db),
    fetchRemoteAirportsManifest(),
  ]);
  return {
    updateAvailable: !installed || installed.version !== remoteManifest.version,
    installedVersion: installed?.version ?? null,
    remoteManifest,
  };
}

/**
 * Downloads the new airports db to a temp file. Safe to call while the
 * current SQLiteDatabase connection is still open — nothing here touches the
 * live database file, so a network failure at this stage leaves the app
 * fully usable.
 */
export async function downloadAirportsUpdate(
  manifest: AirportsManifest,
  onProgress?: (fractionDownloaded: number) => void
): Promise<File> {
  const tempFile = new File(Paths.cache, "airports-update.db");
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
 * Swaps the already-downloaded airports db in place of the current one. The
 * caller MUST close its existing SQLiteDatabase connection before calling
 * this, and reopen (see AirportsDbContext's reload()) after it settles —
 * including on failure, since the old file may already be gone.
 */
export async function applyDownloadedAirportsUpdate(tempFile: File): Promise<void> {
  const target = dbFile();
  if (target.exists) target.delete();
  // WAL sidecar files, if present, are stale once we replace the main file.
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = new File(SQLite.defaultDatabaseDirectory, AIRPORTS_DB_NAME + suffix);
    if (sidecar.exists) sidecar.delete();
  }

  tempFile.move(new Directory(SQLite.defaultDatabaseDirectory));
  // move() renames in place using the source filename, so rename to AIRPORTS_DB_NAME.
  const movedFile = new File(SQLite.defaultDatabaseDirectory, "airports-update.db");
  if (movedFile.exists) {
    movedFile.move(target);
  }
}

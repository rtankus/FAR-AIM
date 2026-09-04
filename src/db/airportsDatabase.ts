import * as SQLite from "expo-sqlite";
import { File, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { CONTENT_MANIFEST_URL } from "../config";
import type { AirportsManifest } from "../airports/types";

// A file smaller than this can't possibly be a real airports.db (the
// smallest bundle ever shipped, name-only procedures with no leg data, was
// ~5.8MB) — used to detect a zero-byte/truncated file left behind by an
// interrupted copy, rather than trusting mere existence.
const MIN_VALID_DB_BYTES = 1_000_000;

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
 *
 * IMPORTANT: `File.copy()` is an expo-file-system AsyncFunction (unlike
 * `.delete()`/`.exists`, which are synchronous) — it must be awaited. Not
 * awaiting it doesn't throw or warn; the JS call just returns immediately
 * while the actual copy keeps running in the background, so a caller that
 * charges ahead (checking the copied size, opening the SQLite db, deleting
 * the temp file) can easily win the race against a 26MB copy and end up
 * looking at a zero-byte or partially-written file. This bit us for real
 * once already — every `.copy()` call below is deliberately awaited.
 */
export async function ensureAirportsDbInstalled(): Promise<void> {
  const target = dbFile();
  if (target.exists) {
    // null means "couldn't determine size" (not "empty") — only a definite
    // too-small number means this is a botched remnant worth redoing.
    if (target.size == null || target.size >= MIN_VALID_DB_BYTES) return;
    target.delete();
  }

  const asset = Asset.fromModule(bundledAirportsDbAsset);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("Bundled airports.db asset has no local URI after download.");

  const tempFile = new File(Paths.cache, "airports-install.db");
  if (tempFile.exists) tempFile.delete();
  await new File(asset.localUri).copy(tempFile);
  if (tempFile.size != null && tempFile.size < MIN_VALID_DB_BYTES) {
    throw new Error(`Bundled airports.db asset copied incomplete (${tempFile.size} bytes) — asset download likely failed.`);
  }
  // copy() + delete() rather than move(): move()'ing onto an existing-named
  // destination was observed leaving a stale `target` untouched instead of
  // being overwritten by the freshly-copied content.
  if (target.exists) target.delete();
  await tempFile.copy(target);
  // Best-effort cleanup — the copy already succeeded, so a failure to
  // delete the now-redundant temp file (e.g. a concurrent caller already
  // cleared it) shouldn't fail the whole install.
  try {
    if (tempFile.exists) tempFile.delete();
  } catch {
    // ignore
  }
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
  // `version` is an ISO-ish build timestamp (see airports-pipeline/build-db.mjs),
  // so string comparison sorts chronologically. Comparing for *greater than*
  // rather than mere inequality matters here specifically: the installed
  // bundle can legitimately be newer than the last-published release (e.g. a
  // fresh app build ships a bundle built after the airports-latest release
  // was last published) — treating "different" as "remote wins" would have
  // this silently downgrade a newer bundled db to an older published one.
  return {
    updateAvailable: !installed || remoteManifest.version > installed.version,
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

  // copy() + delete() rather than move() — see ensureAirportsDbInstalled()'s
  // comment: move()'ing onto an existing-named destination was observed to
  // leave the destination untouched instead of overwriting it. copy() must
  // be awaited (it's an AsyncFunction) or this races the caller reopening
  // the db right after.
  await tempFile.copy(target);
  // Best-effort cleanup — the copy already succeeded, so a failure to
  // delete the now-redundant temp file (e.g. a concurrent caller already
  // cleared it) shouldn't fail the whole install/update.
  try {
    if (tempFile.exists) tempFile.delete();
  } catch {
    // ignore
  }
}

// Combines output/far.json + output/aim.json into a single SQLite database
// (with an FTS5 full-text index) and writes a version manifest. The app ships
// with a copy of this .db bundled at install time, then checks the manifest
// on launch (when online) to see if a newer bundle is available.

import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");
const DB_PATH = path.join(OUT_DIR, "faraim.db");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");
const APP_ASSETS_DIR = path.join(__dirname, "..", "..", "assets", "content");

async function loadSections() {
  const [far, aim] = await Promise.all([
    readFile(path.join(OUT_DIR, "far.json"), "utf-8").then(JSON.parse).catch(() => []),
    readFile(path.join(OUT_DIR, "aim.json"), "utf-8").then(JSON.parse).catch(() => []),
  ]);
  return [...far, ...aim];
}

function buildDatabase(sections) {
  try {
    unlinkSync(DB_PATH);
  } catch {
    // no existing db, fine
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE sections (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      part TEXT NOT NULL,
      section_number TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      path TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE sections_fts USING fts5(
      title, body, content='sections', content_rowid='rowid'
    );

    CREATE TABLE bookmarks (
      section_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE recently_viewed (
      section_id TEXT NOT NULL,
      viewed_at INTEGER NOT NULL
    );

    CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insert = db.prepare(
    `INSERT INTO sections (id, source, part, section_number, title, body, path, sort_order)
     VALUES (@id, @source, @part, @section_number, @title, @body, @path, @sort_order)`
  );
  const insertFts = db.prepare(
    `INSERT INTO sections_fts (rowid, title, body) SELECT rowid, title, body FROM sections WHERE id = ?`
  );

  const insertAll = db.transaction((rows) => {
    rows.forEach((row, i) => {
      insert.run({ ...row, sort_order: i });
      insertFts.run(row.id);
    });
  });
  insertAll(sections);

  return db;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(APP_ASSETS_DIR, { recursive: true });

  const sections = await loadSections();
  if (sections.length === 0) {
    console.error("No sections found — run `npm run fetch:far` and `npm run fetch:aim` first.");
    process.exit(1);
  }

  const db = buildDatabase(sections);

  const version = new Date().toISOString().replace(/[:.]/g, "-");
  db.prepare(`INSERT INTO meta (key, value) VALUES ('content_version', ?)`).run(version);
  db.prepare(`INSERT INTO meta (key, value) VALUES ('built_at', ?)`).run(new Date().toISOString());
  db.close();

  const dbBuffer = await readFile(DB_PATH);
  const sha256 = createHash("sha256").update(dbBuffer).digest("hex");

  const manifest = {
    version,
    builtAt: new Date().toISOString(),
    sha256,
    sizeBytes: dbBuffer.length,
    sectionCount: sections.length,
    farSectionCount: sections.filter((s) => s.source === "FAR").length,
    aimSectionCount: sections.filter((s) => s.source === "AIM").length,
    // Published by .github/workflows/update-content.yml to a rolling
    // "content-latest" GitHub Release. Keep in sync with GITHUB_REPO in
    // ../../src/config.ts.
    downloadUrl:
      "https://github.com/rtankus/FAR-AIM/releases/download/content-latest/faraim.db",
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  // Copy the freshly built db into the app's bundled assets so it ships
  // offline in the next build.
  await copyFile(DB_PATH, path.join(APP_ASSETS_DIR, "faraim.db"));
  await writeFile(
    path.join(APP_ASSETS_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\nBuilt ${DB_PATH}`);
  console.log(`  ${sections.length} sections (${manifest.farSectionCount} FAR, ${manifest.aimSectionCount} AIM)`);
  console.log(`  version ${version}`);
  console.log(`Copied bundle into ${APP_ASSETS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

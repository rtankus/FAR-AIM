// Combines output/{airports,runways,frequencies,navaids,procedures}.json into
// a single SQLite database and writes a version manifest — mirrors
// content-pipeline/scripts/build-db.mjs's shape, but for the airport
// reference data bundle (kept separate from faraim.db since it updates on
// the FAA's ~28-day AIRAC cycle, not weekly with FAR/AIM text).
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");
const DB_PATH = path.join(OUT_DIR, "airports.db");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");
const APP_ASSETS_DIR = path.join(__dirname, "..", "..", "assets", "airports");

async function loadJson(name) {
  return JSON.parse(await readFile(path.join(OUT_DIR, `${name}.json`), "utf-8"));
}

function buildDatabase({ airports, runways, frequencies, navaids, procedures, procedureLegs }) {
  try {
    unlinkSync(DB_PATH);
  } catch {
    // no existing db, fine
  }
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE airports (
      ident TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      elev_ft INTEGER,
      city TEXT, state TEXT, country TEXT,
      type TEXT
    );
    CREATE INDEX idx_airports_lat ON airports(lat);
    CREATE INDEX idx_airports_lon ON airports(lon);

    CREATE TABLE runways (
      airport_ident TEXT NOT NULL,
      ident TEXT NOT NULL,
      length_ft INTEGER, width_ft INTEGER, surface TEXT
    );
    CREATE INDEX idx_runways_airport ON runways(airport_ident);

    CREATE TABLE procedures (
      airport_ident TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL
    );
    CREATE INDEX idx_procedures_airport ON procedures(airport_ident);

    -- One row per procedure leg (a fix along one transition of one
    -- SID/STAR/approach) — the actual "plate" text. Multiple transitions
    -- (e.g. several runway or enroute transitions) share the same
    -- airport_ident/type/name and are told apart by transition_ident.
    CREATE TABLE procedure_legs (
      airport_ident TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      route_type TEXT,
      transition_ident TEXT NOT NULL,
      seq INTEGER NOT NULL,
      fix_ident TEXT,
      path_terminator TEXT,
      desc_code TEXT,
      alt_desc TEXT,
      alt1 INTEGER,
      alt2 INTEGER
    );
    CREATE INDEX idx_legs_procedure ON procedure_legs(airport_ident, type, name, transition_ident, seq);
    CREATE INDEX idx_legs_fix ON procedure_legs(fix_ident);

    CREATE TABLE navaids (
      ident TEXT NOT NULL, name TEXT, type TEXT,
      lat REAL NOT NULL, lon REAL NOT NULL, freq_khz INTEGER
    );
    CREATE INDEX idx_navaids_lat ON navaids(lat);
    CREATE INDEX idx_navaids_lon ON navaids(lon);

    CREATE TABLE frequencies (
      airport_ident TEXT NOT NULL,
      type TEXT NOT NULL, freq_mhz REAL NOT NULL, name TEXT
    );
    CREATE INDEX idx_frequencies_airport ON frequencies(airport_ident);

    CREATE TABLE meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insertAirport = db.prepare(
    `INSERT INTO airports (ident, name, lat, lon, elev_ft, city, state, country, type)
     VALUES (@ident, @name, @lat, @lon, @elevFt, @city, @state, @country, @type)`
  );
  const insertRunway = db.prepare(
    `INSERT INTO runways (airport_ident, ident, length_ft, width_ft, surface)
     VALUES (@airportIdent, @ident, @lengthFt, @widthFt, @surface)`
  );
  const insertProcedure = db.prepare(
    `INSERT INTO procedures (airport_ident, name, type) VALUES (@airportIdent, @name, @type)`
  );
  const insertLeg = db.prepare(
    `INSERT INTO procedure_legs
       (airport_ident, type, name, route_type, transition_ident, seq, fix_ident, path_terminator, desc_code, alt_desc, alt1, alt2)
     VALUES (@airportIdent, @type, @name, @routeType, @transitionIdent, @seq, @fixIdent, @pathTerminator, @descCode, @altDesc, @alt1, @alt2)`
  );
  const insertNavaid = db.prepare(
    `INSERT INTO navaids (ident, name, type, lat, lon, freq_khz) VALUES (@ident, @name, @type, @lat, @lon, @freqKhz)`
  );
  const insertFrequency = db.prepare(
    `INSERT INTO frequencies (airport_ident, type, freq_mhz, name) VALUES (@airportIdent, @type, @freqMhz, @name)`
  );

  const insertAll = db.transaction(() => {
    for (const a of airports) insertAirport.run(a);
    for (const r of runways) insertRunway.run(r);
    for (const p of procedures) insertProcedure.run(p);
    for (const l of procedureLegs) insertLeg.run(l);
    for (const n of navaids) insertNavaid.run(n);
    for (const f of frequencies) insertFrequency.run(f);
  });
  insertAll();

  return db;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(APP_ASSETS_DIR, { recursive: true });

  const [airports, runways, frequencies, navaids, procedures, procedureLegs] = await Promise.all([
    loadJson("airports"),
    loadJson("runways"),
    loadJson("frequencies"),
    loadJson("navaids"),
    loadJson("procedures"),
    loadJson("procedure_legs"),
  ]);

  if (airports.length === 0) {
    console.error("No airports found — run `npm run fetch:ourairports` and `npm run fetch:cifp` first.");
    process.exit(1);
  }

  const db = buildDatabase({ airports, runways, frequencies, navaids, procedures, procedureLegs });

  const version = new Date().toISOString().replace(/[:.]/g, "-");
  db.prepare(`INSERT INTO meta (key, value) VALUES ('data_version', ?)`).run(version);
  db.prepare(`INSERT INTO meta (key, value) VALUES ('built_at', ?)`).run(new Date().toISOString());
  db.close();

  const dbBuffer = await readFile(DB_PATH);
  const sha256 = createHash("sha256").update(dbBuffer).digest("hex");

  const manifest = {
    version,
    builtAt: new Date().toISOString(),
    sha256,
    sizeBytes: dbBuffer.length,
    airportCount: airports.length,
    runwayCount: runways.length,
    procedureCount: procedures.length,
    procedureLegCount: procedureLegs.length,
    navaidCount: navaids.length,
    frequencyCount: frequencies.length,
    // Published by .github/workflows/update-airports.yml to a rolling
    // "airports-latest" release. Keep in sync with GITHUB_REPO in
    // ../../src/config.ts.
    downloadUrl: "https://github.com/rtankus/FAR-AIM/releases/download/airports-latest/airports.db",
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  await copyFile(DB_PATH, path.join(APP_ASSETS_DIR, "airports.db"));
  await writeFile(path.join(APP_ASSETS_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nBuilt ${DB_PATH}`);
  console.log(
    `  ${airports.length} airports, ${runways.length} runways, ${procedures.length} procedures (${procedureLegs.length} legs), ${navaids.length} navaids, ${frequencies.length} frequencies`
  );
  console.log(`  version ${version}`);
  console.log(`Copied bundle into ${APP_ASSETS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

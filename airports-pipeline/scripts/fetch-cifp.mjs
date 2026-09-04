// Downloads the FAA's current CIFP (Coded Instrument Flight Procedures)
// cycle and extracts full procedure leg data for SIDs/STARs/approaches —
// the actual "plate" text: ordered fixes per transition, leg type, and
// IAF/IF/FAF/MAP designation, plus altitude restrictions where coded.
//
// CIFP is ARINC 424-18/19 fixed-width text. Field positions below were
// confirmed both against the FAA's own CIFP Readme (which documents field
// 5.9/5.10 "SID/STAR/Approach Identifier" at cols 14-19 and field 5.7
// "Route Type" at col 20) and empirically, by cross-checking parsed values
// against real published procedures (e.g. KJFK's DEEZZ6 SID climbing to "at
// or above 520" off RW04L, and Colorado mountain departures' initial climb
// altitudes all landing in sane 5-14k ft ranges).
//
// Airport-section procedure records look like:
//   SUSAP KJFKK6DDEEZZ64RW04L 010         0        VA           + 00520 ...
//   SUSAP KJFKK6FI04L  I      010AROKEK6PC0E  I    IF IHIQK6 ...
// cols 7-10 = airport ICAO, col 13 = subsection (D=SID/E=STAR/F=approach),
// cols 14-19 = procedure ident, col 20 = route type, cols 21-25 = transition
// ident, cols 27-29 = sequence number, cols 30-34 = fix ident (if any),
// col 43 = waypoint description code 1 (A=IAF, B=IAF+hold, F=FAF, H=hold,
// I=IF/final approach course fix, M=MAP — per CIFP Readme field 5.17),
// cols 48-49 = path terminator, col 83 = altitude description
// (+ at/above, - at/below, @ at, B window), cols 85-89/90-94 = altitude 1/2.
//
// Altitude/speed parsing here is best-effort from raw fixed-width fields,
// not the authoritative ARINC 424-18 spec text — always cross-check against
// the official published procedure chart before use in flight planning.
import { writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");
const ZIP_PATH = path.join(OUT_DIR, "cifp.zip");

const DOWNLOAD_PAGE = "https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/";

const SUBSECTION_TYPE = { D: "SID", E: "STAR", F: "APPROACH" };
const DESC_CODE_LABEL = { A: "IAF", B: "IAF_HOLD", F: "FAF", H: "HOLD", I: "IF", M: "MAP" };

/** Picks the currently-effective CIFP cycle zip (not a not-yet-effective preview). */
async function findCifpZipUrl() {
  const res = await fetch(DOWNLOAD_PAGE);
  if (!res.ok) throw new Error(`Failed to load CIFP download page: ${res.status}`);
  const html = await res.text();
  const urls = [...html.matchAll(/https:\/\/aeronav\.faa\.gov\/[^"'\s]*CIFP_(\d{6})\.zip/gi)];
  if (urls.length === 0) throw new Error("Could not find a CIFP_*.zip link on the FAA download page.");

  const today = new Date();
  const todayNum = Number(
    `${String(today.getUTCFullYear()).slice(2)}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(today.getUTCDate()).padStart(2, "0")}`
  );
  // Cycle dates are YYMMDD-effective; pick the latest one that has already
  // taken effect (falling back to the earliest listed if none have yet).
  const candidates = urls.map((m) => ({ url: m[0], date: Number(m[1]) })).sort((a, b) => a.date - b.date);
  const effective = [...candidates].reverse().find((c) => c.date <= todayNum);
  return (effective ?? candidates[0]).url;
}

async function downloadZip(url) {
  console.log(`Downloading ${url}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download CIFP zip: ${res.status}`);
  await writeFile(ZIP_PATH, Buffer.from(await res.arrayBuffer()));
}

/** Extracts just the FAACIFP18 data file's text via the system `unzip` (present on macOS + ubuntu-latest runners). */
async function extractCifpText() {
  const { stdout } = await execFileAsync("unzip", ["-p", ZIP_PATH, "FAACIFP18"], {
    maxBuffer: 1024 * 1024 * 200,
  });
  return stdout;
}

function parseAltFeet(raw) {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n > 0 ? n : null;
}

function parseLegs(text) {
  const procNameSeen = new Set();
  const procedures = [];
  const legs = [];

  for (const line of text.split("\n")) {
    if (!line.startsWith("SUSAP ") || line.length < 94) continue;
    const subsection = line[12];
    const type = SUBSECTION_TYPE[subsection];
    if (!type) continue;

    const airportIdent = line.slice(6, 10).trim();
    const name = line.slice(13, 19).trim();
    if (!airportIdent || !name) continue;

    const nameKey = `${airportIdent}|${type}|${name}`;
    if (!procNameSeen.has(nameKey)) {
      procNameSeen.add(nameKey);
      procedures.push({ airportIdent, type, name });
    }

    const routeType = line[19];
    const transitionIdent = line.slice(20, 25).trim() || "ALL";
    const seq = Number(line.slice(26, 29).trim());
    const fixIdent = line.slice(29, 34).trim() || null;
    const descCode = DESC_CODE_LABEL[line[42]] ?? null;
    const pathTerminator = line.slice(47, 49).trim() || null;
    const altDescChar = line[82];
    const altDesc = "+-@B".includes(altDescChar) ? altDescChar : null;
    const alt1 = parseAltFeet(line.slice(84, 89));
    const alt2 = parseAltFeet(line.slice(89, 94));

    if (!Number.isFinite(seq)) continue;
    legs.push({
      airportIdent,
      type,
      name,
      routeType,
      transitionIdent,
      seq,
      fixIdent,
      pathTerminator,
      descCode,
      altDesc,
      alt1,
      alt2,
    });
  }
  return { procedures, legs };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const url = await findCifpZipUrl();
  await downloadZip(url);
  const text = await extractCifpText();
  const { procedures, legs } = parseLegs(text);
  console.log(
    `  ${procedures.length} procedures (SID/STAR/approach names) across ${new Set(procedures.map((p) => p.airportIdent)).size} airports`
  );
  console.log(`  ${legs.length} procedure legs`);
  await writeFile(path.join(OUT_DIR, "procedures.json"), JSON.stringify(procedures));
  await writeFile(path.join(OUT_DIR, "procedure_legs.json"), JSON.stringify(legs));
  await rm(ZIP_PATH, { force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

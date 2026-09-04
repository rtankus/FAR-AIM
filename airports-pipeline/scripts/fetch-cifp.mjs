// Downloads the FAA's current CIFP (Coded Instrument Flight Procedures)
// cycle and extracts just the procedure *names* (SID/STAR/approach) per
// airport — not full route-leg geometry, which needs a real ARINC 424
// parser and isn't needed for "what procedures does this airport have".
//
// CIFP is ARINC 424 fixed-width text. Airport-section records look like:
//   SUSAP KJFKK6DDEEZZ64RW04L 010 ...   <- col 13 'D' = SID
//   SUSAP KJFKK6ECAMRN52ALL   010 ...   <- col 13 'E' = STAR
//   SUSAP KJFKK6FI04L  I      010 ...   <- col 13 'F' = approach
// cols 7-10 = airport ICAO ident, col 13 = subsection, cols 14-19 = the
// 6-char procedure identifier (padded with spaces).
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

function parseProcedures(text) {
  const seen = new Set();
  const procedures = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("SUSAP ")) continue;
    const subsection = line[12];
    const type = SUBSECTION_TYPE[subsection];
    if (!type) continue;
    const airportIdent = line.slice(6, 10).trim();
    const name = line.slice(13, 19).trim();
    if (!airportIdent || !name) continue;
    const key = `${airportIdent}|${type}|${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    procedures.push({ airportIdent, type, name });
  }
  return procedures;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const url = await findCifpZipUrl();
  await downloadZip(url);
  const text = await extractCifpText();
  const procedures = parseProcedures(text);
  console.log(`  ${procedures.length} procedures (SID/STAR/approach names) across ${new Set(procedures.map((p) => p.airportIdent)).size} airports`);
  await writeFile(path.join(OUT_DIR, "procedures.json"), JSON.stringify(procedures));
  await rm(ZIP_PATH, { force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

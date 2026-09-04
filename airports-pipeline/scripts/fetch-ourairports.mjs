// Downloads OurAirports' public CSV exports and filters them down to US
// airports/runways/frequencies/navaids. OurAirports is a public-domain,
// community-maintained dataset (no key required) — same source SandCat
// uses for the airport/runway/frequency side of its data.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");

const BASE = "https://davidmegginson.github.io/ourairports-data";

async function fetchCsv(name) {
  const res = await fetch(`${BASE}/${name}.csv`);
  if (!res.ok) throw new Error(`Failed to fetch ${name}.csv: ${res.status}`);
  return parseCsv(await res.text());
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching OurAirports airports.csv…");
  const airportsRaw = await fetchCsv("airports");
  const usAirports = airportsRaw.filter(
    (r) => r.iso_country === "US" && (r.type === "small_airport" || r.type === "medium_airport" || r.type === "large_airport" || r.type === "seaplane_base" || r.type === "heliport")
  );
  const usIdents = new Set(usAirports.map((r) => r.ident));

  const airports = usAirports.map((r) => ({
    ident: r.ident,
    name: r.name,
    lat: Number(r.latitude_deg),
    lon: Number(r.longitude_deg),
    elevFt: r.elevation_ft ? Number(r.elevation_ft) : null,
    city: r.municipality || null,
    state: (r.iso_region || "").replace(/^US-/, "") || null,
    country: "US",
    type: r.type,
  })).filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon));
  console.log(`  ${airports.length} US airports`);

  console.log("Fetching OurAirports runways.csv…");
  const runwaysRaw = await fetchCsv("runways");
  const runways = runwaysRaw
    .filter((r) => usIdents.has(r.airport_ident) && r.closed !== "1")
    .flatMap((r) => {
      const ident = [r.le_ident, r.he_ident].filter(Boolean).join("/");
      if (!ident) return [];
      return [{
        airportIdent: r.airport_ident,
        ident,
        lengthFt: r.length_ft ? Number(r.length_ft) : null,
        widthFt: r.width_ft ? Number(r.width_ft) : null,
        surface: r.surface || null,
      }];
    });
  console.log(`  ${runways.length} runways`);

  console.log("Fetching OurAirports airport-frequencies.csv…");
  const freqsRaw = await fetchCsv("airport-frequencies");
  const frequencies = freqsRaw
    .filter((r) => usIdents.has(r.airport_ident) && r.frequency_mhz)
    .map((r) => ({
      airportIdent: r.airport_ident,
      type: r.type || "OTHER",
      freqMhz: Number(r.frequency_mhz),
      name: r.description || null,
    }))
    .filter((f) => Number.isFinite(f.freqMhz));
  console.log(`  ${frequencies.length} frequencies`);

  console.log("Fetching OurAirports navaids.csv…");
  const navaidsRaw = await fetchCsv("navaids");
  const navaids = navaidsRaw
    .filter((r) => r.iso_country === "US")
    .map((r) => ({
      ident: r.ident,
      name: r.name || null,
      type: r.type || null,
      lat: Number(r.latitude_deg),
      lon: Number(r.longitude_deg),
      freqKhz: r.frequency_khz ? Number(r.frequency_khz) : null,
    }))
    .filter((n) => Number.isFinite(n.lat) && Number.isFinite(n.lon));
  console.log(`  ${navaids.length} navaids`);

  await writeFile(path.join(OUT_DIR, "airports.json"), JSON.stringify(airports));
  await writeFile(path.join(OUT_DIR, "runways.json"), JSON.stringify(runways));
  await writeFile(path.join(OUT_DIR, "frequencies.json"), JSON.stringify(frequencies));
  await writeFile(path.join(OUT_DIR, "navaids.json"), JSON.stringify(navaids));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

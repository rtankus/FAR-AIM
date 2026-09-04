// Downloads the FAA's current d-TPP (Terminal Procedures Publication) chart
// metadata — the index of every published approach/departure/arrival/
// airport-diagram/minimums PDF, per airport, for the current AIRAC cycle —
// and resolves each into a direct PDF download URL. We don't bundle the
// PDFs themselves (thousands of them, easily multiple GB); the app fetches
// a specific chart's PDF on demand from these URLs and can save it for
// offline viewing (see src/db/chartFiles.ts).
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");

// Chart types worth surfacing in the app; MIN/HOT/LAH etc. are FAA-internal
// categories not directly useful without much more UI (takeoff/alternate
// minimums text, hot spot diagrams) — skip them for now. The FAA's own code
// for arrivals is "STR", not "STAR" (that'd be too easy) — normalized to
// "STAR" below to match this app's ProcedureType naming everywhere else.
const KEEP_CHART_CODES = new Set(["IAP", "DP", "STR", "APD"]);
const NORMALIZE_CHART_CODE = { STR: "STAR" };

/**
 * The FAA's official chart-currency API (no key required) — same source
 * used for the d-TPP bulk download zips — tells us the currently-effective
 * cycle's edition date/number, which is how the XML metadata's URL is
 * built (e.g. edition 9 of "26" -> cycle "2609").
 */
async function findCurrentDtppCycle() {
  const res = await fetch("https://external-api.faa.gov/apra/dtpp/chart?edition=current");
  if (!res.ok) throw new Error(`Failed to fetch d-TPP edition info: ${res.status}`);
  const xml = await res.text();
  const editionDate = xml.match(/<editionDate>([^<]+)<\/editionDate>/)?.[1]; // MM/DD/YYYY
  const editionNumber = xml.match(/<editionNumber>([^<]+)<\/editionNumber>/)?.[1];
  if (!editionDate || !editionNumber) throw new Error("Could not parse d-TPP edition info.");
  const year = editionDate.split("/")[2].slice(2);
  const cycle = `${year}${editionNumber.padStart(2, "0")}`;
  return { cycle, editionDate };
}

function unescapeXml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Minimal, purpose-built parser for the d-TPP metafile's flat, predictable
 * structure — a full XML DOM parser isn't worth pulling in as a dependency
 * for one file, and this is ~16MB of very regular <record> blocks nested
 * under <airport_name> under <city_name> under <state_code>.
 */
function parseCharts(xml) {
  const charts = [];
  // Airport blocks: capture the icao_ident/apt_ident attributes and the
  // inner content up to the next airport_name (or the section's close).
  const airportRe = /<airport_name\b[^>]*\bicao_ident="([^"]*)"[^>]*\bapt_ident="([^"]*)"[^>]*>([\s\S]*?)<\/airport_name>/g;
  // Some records order attributes with apt_ident before icao_ident — handle both.
  const airportReAlt = /<airport_name\b[^>]*\bapt_ident="([^"]*)"[^>]*\bicao_ident="([^"]*)"[^>]*>([\s\S]*?)<\/airport_name>/g;
  const recordRe = /<record>([\s\S]*?)<\/record>/g;
  const fieldRe = (name) => new RegExp(`<${name}>([^<]*)</${name}>`);

  function handleAirportBlock(icaoIdent, aptIdent, inner) {
    const airportIdent = (icaoIdent || "").trim() || (aptIdent || "").trim();
    if (!airportIdent) return;
    let m;
    while ((m = recordRe.exec(inner)) !== null) {
      const record = m[1];
      const rawChartCode = record.match(fieldRe("chart_code"))?.[1]?.trim();
      if (!rawChartCode || !KEEP_CHART_CODES.has(rawChartCode)) continue;
      const chartName = record.match(fieldRe("chart_name"))?.[1]?.trim();
      const pdfName = record.match(fieldRe("pdf_name"))?.[1]?.trim();
      if (!chartName || !pdfName) continue;
      const chartCode = NORMALIZE_CHART_CODE[rawChartCode] ?? rawChartCode;
      charts.push({ airportIdent, chartCode, chartName: unescapeXml(chartName), pdfName });
    }
  }

  let m;
  while ((m = airportRe.exec(xml)) !== null) handleAirportBlock(m[1], m[2], m[3]);
  while ((m = airportReAlt.exec(xml)) !== null) handleAirportBlock(m[2], m[1], m[3]);
  return charts;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const { cycle, editionDate } = await findCurrentDtppCycle();
  console.log(`d-TPP cycle ${cycle} (effective ${editionDate})`);

  const xmlUrl = `https://aeronav.faa.gov/d-tpp/${cycle}/xml_data/d-TPP_Metafile.xml`;
  console.log(`Downloading ${xmlUrl}…`);
  const res = await fetch(xmlUrl);
  if (!res.ok) throw new Error(`Failed to download d-TPP metafile: ${res.status}`);
  const xml = await res.text();

  const charts = parseCharts(xml).map((c) => ({
    ...c,
    pdfUrl: `https://aeronav.faa.gov/d-tpp/${cycle}/${c.pdfName}`,
  }));
  console.log(`  ${charts.length} charts across ${new Set(charts.map((c) => c.airportIdent)).size} airports`);

  await writeFile(path.join(OUT_DIR, "charts.json"), JSON.stringify(charts));
  await writeFile(path.join(OUT_DIR, "dtpp_cycle.json"), JSON.stringify({ cycle, editionDate }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

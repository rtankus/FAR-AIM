// Fetches Title 14 CFR (the FARs) from the official eCFR API and extracts
// per-section plain-text records. eCFR is public, free, and requires no API key:
// https://www.ecfr.gov/developers/documentation/api/v1
//
// Output: content-pipeline/output/far.json — array of Section records (see build-db.mjs).

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");

// Parts most relevant to a general-aviation / instrument pilot audience.
// Add/remove part numbers here to change coverage (e.g. add "121", "135" for
// air-carrier ops, or "23"/"25" for airworthiness).
const PARTS = ["1", "43", "61", "67", "68", "71", "91", "93", "97"];

async function getLatestIssueDate() {
  const res = await fetch("https://www.ecfr.gov/api/versioner/v1/titles.json");
  if (!res.ok) throw new Error(`Failed to fetch eCFR titles list: ${res.status}`);
  const { titles } = await res.json();
  const title14 = titles.find((t) => t.number === 14);
  if (!title14) throw new Error("Title 14 not found in eCFR titles list");
  return title14.latest_issue_date; // eCFR only has data up through this date
}

// Decodes every numeric character reference (&#xB1; &#8217; etc.) plus the
// handful of named entities the eCFR XML actually uses — rather than a
// hardcoded shortlist, which silently left anything not on the list (curly
// quotes, ±, en dashes, ...) as literal "&#x201C;"-style text in the body.
function decodeEntities(str) {
  return str
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // must run last, so a decoded "&#38;" -> "&" isn't re-escaped
}

function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<HEAD>.*?<\/HEAD>/s, "") // title handled separately
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s*\n\s*/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

function extractSections(xml, part) {
  const sections = [];
  const divRegex = /<DIV8 N="([^"]+)" TYPE="SECTION"[^>]*>([\s\S]*?)<\/DIV8>/g;
  let match;
  while ((match = divRegex.exec(xml))) {
    const [, sectionNumber, inner] = match;
    const headMatch = inner.match(/<HEAD>([\s\S]*?)<\/HEAD>/);
    const rawTitle = headMatch ? headMatch[1] : sectionNumber;
    const title = stripTags(rawTitle).replace(/^§\s*[\d.]+\s*/, "").trim();
    const body = stripTags(inner);
    sections.push({
      id: `far-${sectionNumber}`,
      source: "FAR",
      part,
      section_number: sectionNumber,
      title: title || sectionNumber,
      body,
      path: `14 CFR > Part ${part} > §${sectionNumber}`,
    });
  }
  return sections;
}

async function fetchPart(part, issueDate) {
  const url = `https://www.ecfr.gov/api/versioner/v1/full/${issueDate}/title-14.xml?part=${part}`;
  const res = await fetch(url, { headers: { "Accept-Encoding": "gzip" } });
  if (!res.ok) {
    throw new Error(`eCFR fetch failed for part ${part}: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  return extractSections(xml, part);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const issueDate = await getLatestIssueDate();
  console.log(`Using eCFR issue date ${issueDate}`);
  const all = [];
  for (const part of PARTS) {
    process.stdout.write(`Fetching 14 CFR Part ${part}... `);
    try {
      const sections = await fetchPart(part, issueDate);
      console.log(`${sections.length} sections`);
      all.push(...sections);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }
  const outPath = path.join(OUT_DIR, "far.json");
  await writeFile(outPath, JSON.stringify(all, null, 2));
  console.log(`\nWrote ${all.length} FAR sections to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

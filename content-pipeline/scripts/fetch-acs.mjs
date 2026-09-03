// Fetches Advisory Circulars (ACs) relevant to the same 14 CFR parts this
// app already covers (see PARTS in fetch-far.mjs) from the FAA's public AC
// site, downloads each PDF, and extracts its text.
//
// The site (faa.gov/regulations_policies/advisory_circulars) is a classic
// server-rendered ColdFusion app with no public JSON API, but it exposes
// two things we can use without a browser:
//   - A CSV export of every *current* AC (document.exportAll/statusID/2) —
//     the authoritative list, with each AC's number (e.g. "91-62A", which
//     encodes its 14 CFR part as the prefix before the dash).
//   - A free-text search (document.list/?q=<query>) whose results are a
//     plain <table>: AC number in one <td>, a link to
//     document.information/documentID/NNNNN (title as the link text) in
//     the next. That detail page in turn links to the actual PDF.
// The site's own topic/part browse tree (document.list/topicID/N) looks
// like the obvious way to resolve "AC number -> documentID", but it's a
// curated, incomplete editorial grouping — e.g. it's missing a large
// fraction of real Part 91 ACs, so that approach silently drops documents.
// Searching by the exact AC number and matching the exact row instead finds
// every document the CSV lists.
//
// Output: content-pipeline/output/ac.json — array of Section records (see
// build-db.mjs), using source "AC" and part = the leading CFR part number.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");
const BASE = "https://www.faa.gov/regulations_policies/advisory_circulars/index.cfm/go/";

// Same GA/instrument-pilot-relevant parts as fetch-far.mjs's PARTS.
const TARGET_PARTS = new Set(["1", "43", "61", "67", "68", "71", "91", "93", "97"]);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function partOf(documentNumber) {
  const m = documentNumber.match(/^(\d+)/);
  return m ? m[1] : null;
}

/** Parses the CSV export of current ACs into { documentNumber, title }[]. */
function parseCsv(csv) {
  // Simple CSV parser: fine here since every field is quoted and none of
  // them contain literal newlines (verified against the real export).
  const lines = csv.trim().split("\n").slice(1); // drop header row
  return lines.map((line) => {
    const fields = line.match(/"([^"]*)"/g).map((f) => f.slice(1, -1));
    const [, , documentNumber, , title] = fields;
    return { documentNumber, title };
  });
}

/** Looks up one AC's documentID by searching for its exact number. */
async function resolveDocumentId(documentNumber) {
  const html = await fetchText(`${BASE}document.list/?q=${encodeURIComponent(documentNumber)}&statusID=`);
  const $ = cheerio.load(html);
  let documentId = null;
  $("table.searchResults tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if ($(cells[0]).text().trim() !== documentNumber) return;
    const idMatch = $(cells[1]).find("a[href*='documentID/']").attr("href")?.match(/documentID\/(\d+)/);
    if (idMatch) documentId = idMatch[1];
  });
  return documentId;
}

async function resolvePdfUrl(documentId) {
  const html = await fetchText(`${BASE}document.information/documentID/${documentId}`);
  const m = html.match(/href="(https:\/\/www\.faa\.gov\/documentLibrary\/media\/Advisory_Circular\/[^"]+\.pdf)"/i);
  return m ? m[1] : null;
}

async function extractPdfText(pdfUrl) {
  const res = await fetch(pdfUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${pdfUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  await parser.destroy();
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  console.log("Fetching current-AC list (CSV)...");
  const csv = await fetchText(`${BASE}document.exportAll/statusID/2`);
  const allDocs = parseCsv(csv);
  const targetDocs = allDocs.filter((d) => TARGET_PARTS.has(partOf(d.documentNumber)));
  console.log(`${targetDocs.length} current ACs match our target parts (of ${allDocs.length} total).`);

  const sections = [];
  let sortOrder = 0;
  for (const doc of targetDocs) {
    const part = partOf(doc.documentNumber);
    try {
      const documentId = await resolveDocumentId(doc.documentNumber);
      if (!documentId) throw new Error("not found by search");
      await sleep(150);
      const pdfUrl = await resolvePdfUrl(documentId);
      if (!pdfUrl) throw new Error("no PDF link on detail page");
      console.log(`Fetching AC ${doc.documentNumber} (${pdfUrl})...`);
      const body = await extractPdfText(pdfUrl);
      sections.push({
        id: `ac-${doc.documentNumber}`,
        source: "AC",
        part,
        section_number: `AC ${doc.documentNumber}`,
        title: doc.title,
        body,
        path: `Advisory Circulars > Part ${part} > AC ${doc.documentNumber}`,
        sort_order: sortOrder++,
      });
    } catch (err) {
      console.warn(`Skipping AC ${doc.documentNumber}: ${err.message}`);
    }
    await sleep(150);
  }

  await writeFile(path.join(OUT_DIR, "ac.json"), JSON.stringify(sections, null, 2));
  console.log(`\nWrote ${sections.length} AC sections to ${path.join(OUT_DIR, "ac.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

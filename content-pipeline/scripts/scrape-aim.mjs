// Scrapes the FAA's official HTML Aeronautical Information Manual.
// The AIM is a U.S. government work (17 U.S.C. §105) — public domain, no
// licensing restriction on parsing/redistributing it.
//
// Structure (verified against the live site):
//   .../aim_html/index.html          -> links to every chapN_sectionM.html
//   .../aim_html/chapN_sectionM.html -> <h1 class="chapter-title">, <h2 class="section-title">,
//                                        then <h4 class="paragraph-title" id="N-M-P"> per numbered
//                                        paragraph, followed by its <p>/<ol>/<aside> content until
//                                        the next <h4>.
// Appendix pages (appendix_N.html) are scanned paper forms (images only) — skipped.
//
// Output: content-pipeline/output/aim.json — array of Section records (see build-db.mjs).

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "output");
const BASE = "https://www.faa.gov/air_traffic/publications/atpubs/aim_html/";

async function fetchHtml(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

async function discoverSectionPages() {
  const html = await fetchHtml(BASE + "index.html");
  const $ = cheerio.load(html);
  const pages = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (/^\.?\/?chap\d+_section_\d+\.html$/.test(href)) {
      pages.add(href.replace(/^\.?\//, ""));
    }
  });
  return [...pages].sort();
}

function parseSectionPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const chapterTitle = $("h1.chapter-title").first().text().trim();
  const sectionTitle = $("h2.section-title").first().text().trim();
  const chapterMatch = pageUrl.match(/chap(\d+)_section_(\d+)/);
  const chapterNum = chapterMatch ? chapterMatch[1] : "?";

  const records = [];
  $("h4.paragraph-title").each((_, el) => {
    const $h4 = $(el);
    const paraId = $h4.attr("id") || $h4.text().trim().split(" ")[0];
    const title = $h4.text().replace(/^\s*[\d-]+\.\s*/, "").trim();

    // Collect sibling content until the next h4.paragraph-title
    let bodyParts = [];
    let node = $h4[0].next;
    while (node) {
      if (node.type === "tag" && node.name === "h4" && $(node).hasClass("paragraph-title")) break;
      const $node = $(node);
      if (node.type === "tag") {
        const text = $node.text().replace(/\s+/g, " ").trim();
        if (text) bodyParts.push(text);
      }
      node = node.next;
    }

    records.push({
      id: `aim-${paraId}`,
      source: "AIM",
      part: `Chapter ${chapterNum}`,
      section_number: paraId,
      title: title || paraId,
      body: bodyParts.join("\n\n"),
      path: `AIM > ${chapterTitle} > ${sectionTitle} > ${paraId}`,
    });
  });
  return records;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const pages = await discoverSectionPages();
  console.log(`Discovered ${pages.length} AIM section pages`);

  const all = [];
  for (const page of pages) {
    process.stdout.write(`Fetching ${page}... `);
    try {
      const html = await fetchHtml(BASE + page);
      const records = parseSectionPage(html, page);
      console.log(`${records.length} paragraphs`);
      all.push(...records);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  const outPath = path.join(OUT_DIR, "aim.json");
  await writeFile(outPath, JSON.stringify(all, null, 2));
  console.log(`\nWrote ${all.length} AIM paragraphs to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

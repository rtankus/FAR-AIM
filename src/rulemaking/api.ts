import type { RulemakingDocument } from "./types";

// The Federal Register's public Documents API — no key required. This is
// the same data that backs the FAA's "recently published" rulemaking page
// (https://www.faa.gov/regulations_policies/rulemaking/recently_published),
// served as stable JSON instead of scraped HTML.
const BASE_URL = "https://www.federalregister.gov/api/v1/documents.json";
const REQUEST_TIMEOUT_MS = 10_000;

interface RawDocument {
  title: string;
  type: string;
  abstract: string | null;
  document_number: string;
  html_url: string;
  publication_date: string;
}

interface RawResponse {
  results: RawDocument[];
}

/** Most recently published FAA rules and proposed rules, newest first. */
export async function fetchRecentFaaRulemaking(limit = 10): Promise<RulemakingDocument[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("conditions[agencies][]", "federal-aviation-administration");
  url.searchParams.append("conditions[type][]", "RULE");
  url.searchParams.append("conditions[type][]", "PRORULE");
  url.searchParams.set("order", "newest");
  url.searchParams.set("per_page", String(limit));
  for (const field of ["title", "type", "abstract", "document_number", "html_url", "publication_date"]) {
    url.searchParams.append("fields[]", field);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`federalregister.gov returned ${res.status}`);
    }
    const body = (await res.json()) as RawResponse;
    return body.results.map((d) => ({
      title: d.title,
      type: d.type,
      abstract: d.abstract,
      documentNumber: d.document_number,
      htmlUrl: d.html_url,
      publicationDate: d.publication_date,
    }));
  } finally {
    clearTimeout(timer);
  }
}

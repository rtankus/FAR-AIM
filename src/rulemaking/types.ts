// Shapes for the Federal Register's public JSON API
// (https://www.federalregister.gov/developers/documentation/api/v1), which
// we use instead of scraping the FAA's "recently published" HTML page —
// that page blocks non-browser requests (403), and its markup isn't a
// stable contract. The Federal Register API is the underlying source for
// that page's data, unauthenticated, and versioned.

export type RulemakingType = "Rule" | "Proposed Rule" | (string & {});

export interface RulemakingDocument {
  title: string;
  type: RulemakingType;
  abstract: string | null;
  documentNumber: string;
  htmlUrl: string;
  publicationDate: string; // "YYYY-MM-DD"
  [key: string]: unknown;
}

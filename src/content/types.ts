export type Source = "FAR" | "AIM";

export interface Section {
  id: string;
  source: Source;
  part: string;
  section_number: string;
  title: string;
  body: string;
  path: string;
  sort_order: number;
}

export interface PartSummary {
  part: string;
  count: number;
}

export interface ContentManifest {
  version: string;
  builtAt: string;
  sha256: string;
  sizeBytes: number;
  sectionCount: number;
  farSectionCount: number;
  aimSectionCount: number;
  downloadUrl: string;
}

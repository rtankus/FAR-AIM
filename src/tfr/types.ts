export interface Tfr {
  /** FAA NOTAM number, e.g. "6/9847" — what the FAA site and briefings call it. */
  id: string;
  /** Human-readable summary, e.g. "IRON COUNTY, WI, Tue Sep 1 – Tue Sep 8 2026 UTC". */
  title: string;
  state: string | null;
  /** FAA's category for the restriction, e.g. HAZARDS, SECURITY, VIP, SPACE, AIRSHOW. */
  legal: string;
  /** Raw FAA timestamp (yyyyMMddHHmm, UTC) of the last edit to this TFR. */
  lastModified: string;
  /** Polygon/multipolygon in [lon, lat] pairs, as published by the FAA. */
  geometry: GeoJsonGeometry;
}

export type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

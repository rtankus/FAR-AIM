import type { GeoJsonGeometry, Tfr } from "./types";

// tfr.faa.gov doesn't publish a documented public API, but its own map/list
// UI (the "tfr3" site) is backed by a public GeoServer instance that returns
// plain GeoJSON with no key required — the same data the FAA's own site
// renders. This is unofficial/undocumented plumbing: it can change without
// notice, so every caller here treats a failure as routine, not exceptional.
const WFS_URL =
  "https://tfr.faa.gov/geoserver/TFR/ows" +
  "?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeNames=TFR:V_TFR_LOC&outputFormat=application/json";

const REQUEST_TIMEOUT_MS = 15_000;

interface WfsFeature {
  geometry: GeoJsonGeometry;
  properties: {
    NOTAM_KEY: string;
    TITLE: string;
    STATE: string | null;
    LEGAL: string;
    LAST_MODIFICATION_DATETIME: string;
  };
}

interface WfsResponse {
  features: WfsFeature[];
}

/** A geometry's polygons, each as its own list of rings (outer + holes) — a Polygon is just one such list. */
function polygonsOf(geom: GeoJsonGeometry): number[][][][] {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}

/**
 * The FAA's WFS service publishes one feature per contiguous polygon, so a
 * TFR with multiple separate areas (or one that crosses the geoserver's own
 * tiling) comes back as several features sharing the same NOTAM_KEY — which
 * broke every screen keying a list by `tfr.id` (React "duplicate key"
 * warning, and FlatList silently dropping rows). Merge those into one Tfr
 * with a combined MultiPolygon instead of letting duplicates reach the UI.
 */
function mergeByNotamKey(features: WfsFeature[]): Tfr[] {
  const byKey = new Map<string, Tfr>();
  for (const f of features) {
    const key = f.properties.NOTAM_KEY;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        id: key,
        title: f.properties.TITLE,
        state: f.properties.STATE,
        legal: f.properties.LEGAL,
        lastModified: f.properties.LAST_MODIFICATION_DATETIME,
        geometry: f.geometry,
      });
      continue;
    }
    const coordinates: number[][][][] = [...polygonsOf(existing.geometry), ...polygonsOf(f.geometry)];
    existing.geometry = { type: "MultiPolygon", coordinates };
    if (f.properties.LAST_MODIFICATION_DATETIME > existing.lastModified) {
      existing.lastModified = f.properties.LAST_MODIFICATION_DATETIME;
    }
  }
  return [...byKey.values()];
}

/** Every active/upcoming TFR the FAA is currently publishing. */
export async function fetchActiveTfrs(): Promise<Tfr[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(WFS_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`FAA TFR service returned ${res.status}`);
    const data: WfsResponse = await res.json();
    return mergeByNotamKey(data.features.filter((f) => f.geometry && f.properties.NOTAM_KEY));
  } finally {
    clearTimeout(timer);
  }
}

/** Link to the FAA's own detail page (full legal NOTAM text) for one TFR. */
export function tfrDetailUrl(notamKey: string): string {
  // NOTAM_KEY looks like "6/9847-1-FDC-F" or plain "6/9847"; the detail page
  // only wants the leading "<num>/<seq>" pair.
  const [num, rest] = notamKey.split("/");
  const seq = (rest ?? "").split("-")[0];
  return `https://tfr.faa.gov/tfr3/?page=detail_${num}_${seq}`;
}

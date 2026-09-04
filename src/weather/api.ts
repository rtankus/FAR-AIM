import type { AirSigmet, BoundingBox, Metar, Pirep, Taf } from "./types";
import { bboxParam } from "./distance";

// aviationweather.gov's Data API. Endpoints are served straight off their
// edge cache (data refreshes roughly every 1-2 minutes for METARs, slower for
// TAFs/AIRMETs/SIGMETs/PIREPs) — see https://aviationweather.gov/data/api/#cache.
// There's no API key: it's a public, unauthenticated JSON API.
const BASE_URL = "https://aviationweather.gov/api/data";

const REQUEST_TIMEOUT_MS = 10_000;

async function fetchJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`aviationweather.gov returned ${res.status} for ${path}`);
    }
    const text = await res.text();
    // Empty results come back as an empty string rather than "[]".
    if (!text.trim()) return [] as unknown as T;
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

function idsParam(idents: string[]): string {
  return idents.map((s) => s.trim().toUpperCase()).filter(Boolean).join(",");
}

/** Current METAR(s) for one or more ICAO idents. */
export function fetchMetarsByIds(idents: string[]): Promise<Metar[]> {
  return fetchJson<Metar[]>("metar", { ids: idsParam(idents), format: "json" });
}

/** Current TAF(s) for one or more ICAO idents. */
export function fetchTafsByIds(idents: string[]): Promise<Taf[]> {
  return fetchJson<Taf[]>("taf", { ids: idsParam(idents), format: "json" });
}

/** METARs for every reporting station inside a bounding box. */
export function fetchMetarsByBbox(box: BoundingBox): Promise<Metar[]> {
  return fetchJson<Metar[]>("metar", { bbox: bboxParam(box), format: "json" });
}

/** Active AIRMETs/SIGMETs whose area intersects a bounding box. */
export function fetchAirSigmetsByBbox(box: BoundingBox): Promise<AirSigmet[]> {
  return fetchJson<AirSigmet[]>("airsigmet", { bbox: bboxParam(box), format: "json" });
}

/** PIREPs reported within a bounding box over the last `ageHours` hours. */
export function fetchPirepsByBbox(box: BoundingBox, ageHours = 2): Promise<Pirep[]> {
  return fetchJson<Pirep[]>("pirep", { bbox: bboxParam(box), age: String(ageHours), format: "json" });
}

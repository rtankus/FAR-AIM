import type { SQLiteDatabase } from "expo-sqlite";
import { getAccessToken, NMS_API_BASE } from "./auth";
import { getNotamCredentials } from "./credentials";
import { notamFromFeature, type NmsNotamResponse, type Notam } from "./types";

const REQUEST_TIMEOUT_MS = 15_000;

export class NotamCredentialsMissingError extends Error {
  constructor() {
    super("Add your FAA NOTAM API (NMS-API) credentials in Settings to use this feature.");
    this.name = "NotamCredentialsMissingError";
  }
}

async function requestNotams(userDb: SQLiteDatabase, params: Record<string, string>): Promise<Notam[]> {
  const creds = await getNotamCredentials(userDb);
  if (!creds) throw new NotamCredentialsMissingError();
  const token = await getAccessToken(creds);

  const url = new URL(`${NMS_API_BASE}/v1/notams`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}`, nmsResponseFormat: "GEOJSON" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`FAA NOTAM API returned ${res.status}`);
    const data: NmsNotamResponse = await res.json();
    return (data.data.geojson ?? []).map(notamFromFeature);
  } finally {
    clearTimeout(timer);
  }
}

/** Active NOTAMs for one airport, by domestic or ICAO identifier. */
export function fetchNotamsByLocation(userDb: SQLiteDatabase, location: string): Promise<Notam[]> {
  return requestNotams(userDb, { location: location.trim().toUpperCase() });
}

/** Active NOTAMs within `radiusNm` (max 100) of a point. */
export function fetchNotamsByRadius(
  userDb: SQLiteDatabase,
  lat: number,
  lon: number,
  radiusNm: number
): Promise<Notam[]> {
  return requestNotams(userDb, {
    latitude: String(lat),
    longitude: String(lon),
    radius: String(Math.min(100, Math.max(0, radiusNm))),
  });
}

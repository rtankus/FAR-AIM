import type { SQLiteDatabase } from "expo-sqlite";
import { fetchMetarsByIds } from "../weather/api";
import { cachedFetch } from "../weather/cache";

/**
 * Resolves an ICAO airport identifier to coordinates. There's no dedicated
 * airport database in this app — instead this reads the lat/lon off the
 * airport's METAR station record, which aviationweather.gov returns for any
 * reporting airport anyway. Routed through the same weather cache (and the
 * same `metar:<ID>` key the Weather screen uses), so a search here is
 * offline-capable if that airport's METAR was already looked up.
 */
export async function resolveAirportCoords(
  userDb: SQLiteDatabase,
  ident: string
): Promise<{ lat: number; lon: number } | null> {
  const id = ident.trim().toUpperCase();
  if (!id) return null;
  const { data } = await cachedFetch(userDb, `metar:${id}`, () => fetchMetarsByIds([id]));
  const metar = data[0];
  if (!metar || metar.lat == null || metar.lon == null) return null;
  return { lat: metar.lat, lon: metar.lon };
}

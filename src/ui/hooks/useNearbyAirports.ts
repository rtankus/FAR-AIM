import { useCallback, useEffect, useMemo, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { useLocation, type Coords } from "./useLocation";
import { airportsInBbox } from "../../airports/queries";
import { boundingBoxAround, distanceNm } from "../../weather/distance";
import type { Airport } from "../../airports/types";

export interface NearbyAirportRow {
  airport: Airport;
  dist: number;
}

export const NEARBY_AIRPORT_RADII_NM = [10, 25, 50, 100] as const;
export type NearbyAirportRadius = (typeof NEARBY_AIRPORT_RADII_NM)[number];

/**
 * GPS-centered "airports near me" lookup against the bundled airports.db —
 * same shape as useNearbyTfrs/useNearbyWeather, but simpler: this is local
 * reference data with no network fetch and no cache to go stale, so there's
 * no stale-while-revalidate layer here, just a bbox query re-run per radius.
 */
export function useNearbyAirports(airportsDb: SQLiteDatabase | null, radiusNm: NearbyAirportRadius) {
  const { locate } = useLocation();
  const [airports, setAirports] = useState<Airport[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (radius: NearbyAirportRadius) => {
      if (!airportsDb) return;
      setLoading(true);
      setError(null);
      try {
        const here = await locate();
        if (!here) {
          setError("Location permission is needed to find nearby airports.");
          return;
        }
        setCoords(here);
        const box = boundingBoxAround(here.lat, here.lon, radius);
        setAirports(await airportsInBbox(airportsDb, box));
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err));
      } finally {
        setLoading(false);
      }
    },
    [airportsDb, locate]
  );

  useEffect(() => {
    load(radiusNm);
    // Reload whenever the db finishes loading or the radius changes — a
    // wider radius needs a fresh (wider) bbox query, not just re-filtering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airportsDb, radiusNm]);

  const rows = useMemo<NearbyAirportRow[]>(() => {
    if (!coords) return [];
    return airports
      .map((airport): NearbyAirportRow => ({ airport, dist: distanceNm(coords.lat, coords.lon, airport.lat, airport.lon) }))
      .filter((r) => r.dist <= radiusNm)
      .sort((a, b) => a.dist - b.dist);
  }, [airports, coords, radiusNm]);

  return { rows, coords, loading, error, refresh: () => load(radiusNm) };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { useLocation, type Coords } from "./useLocation";
import { fetchActiveTfrs } from "../../tfr/api";
import { staleWhileRevalidateTfrs } from "../../tfr/cache";
import { tfrDistanceNm } from "../../tfr/distance";
import type { Tfr } from "../../tfr/types";

export interface NearbyTfrRow {
  tfr: Tfr;
  dist: number;
}

/**
 * Simple GPS-centered "TFRs near me" lookup — a stripped-down sibling of
 * TfrListScreen's own logic (no airport-search override), built for screens
 * that just want a quick nearby list rather than the full search/radius UI.
 *
 * Location + the full TFR list are only fetched once per mount; changing
 * `radiusNm` just re-filters/sorts what's already in memory. Uses
 * stale-while-revalidate: cached TFRs (if any) paint immediately, then
 * quietly upgrade once a fresh fetch lands.
 */
export function useNearbyTfrs(userDb: SQLiteDatabase, radiusNm: number) {
  const { locate } = useLocation();
  const [allTfrs, setAllTfrs] = useState<Tfr[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ fetchedAt: number; stale: boolean; offline: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const here = await locate();
      if (!here) {
        setError("Location permission is needed to find nearby TFRs.");
        return;
      }
      setCoords(here);
      const res = await staleWhileRevalidateTfrs(userDb, fetchActiveTfrs, (fresh) => {
        setAllTfrs(fresh.data);
        setMeta({ fetchedAt: fresh.fetchedAt, stale: fresh.stale, offline: fresh.offline });
      });
      setAllTfrs(res.data);
      setMeta({ fetchedAt: res.fetchedAt, stale: res.stale, offline: res.offline });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [locate, userDb]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo<NearbyTfrRow[]>(() => {
    if (!coords) return [];
    return allTfrs
      .map((tfr): NearbyTfrRow => ({ tfr, dist: tfrDistanceNm(tfr, coords.lat, coords.lon) }))
      .filter((r) => r.dist <= radiusNm)
      .sort((a, b) => a.dist - b.dist);
  }, [allTfrs, coords, radiusNm]);

  return { rows, coords, loading, error, meta, refresh: load };
}

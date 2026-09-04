import { useCallback, useEffect, useMemo, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { useLocation, type Coords } from "./useLocation";
import { fetchAirSigmetsByBbox, fetchMetarsByBbox, fetchPirepsByBbox } from "../../weather/api";
import { staleWhileRevalidate } from "../../weather/cache";
import { boundingBoxAround, distanceNm } from "../../weather/distance";
import type { AirSigmet, Metar, Pirep } from "../../weather/types";

export const NEARBY_RADII_NM = [25, 50, 100, 150] as const;
export type NearbyRadius = (typeof NEARBY_RADII_NM)[number];

export type NearbyRow =
  | { kind: "metar"; key: string; data: Metar; dist: number }
  | { kind: "airsigmet"; key: string; data: AirSigmet; dist: number | null }
  | { kind: "pirep"; key: string; data: Pirep; dist: number | null };

interface Slice<T> {
  data: T[];
  fetchedAt: number;
  stale: boolean;
  offline: boolean;
}

// Cache key is bucketed to ~30nm (0.5°) so repeated checks near the same spot
// (e.g. re-checking mid-flight with a flaky connection) still hit the cache
// instead of missing on every tiny GPS drift.
function bucket(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * GPS-based METAR/AIRMET-SIGMET/PIREP lookup, shared by the Weather screen
 * (shown inline, no tap needed) and anywhere else that wants the same data.
 * Loads automatically at the default radius on mount, and uses
 * stale-while-revalidate: whatever's cached paints immediately, then quietly
 * upgrades in place once a fresh fetch lands.
 */
export function useNearbyWeather(userDb: SQLiteDatabase) {
  const { locate } = useLocation();
  const [radius, setRadius] = useState<NearbyRadius>(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [metars, setMetars] = useState<Slice<Metar> | null>(null);
  const [advisories, setAdvisories] = useState<Slice<AirSigmet> | null>(null);
  const [pireps, setPireps] = useState<Slice<Pirep> | null>(null);

  const load = useCallback(
    async (radiusNm: NearbyRadius) => {
      setLoading(true);
      setError(null);
      try {
        const here = await locate();
        if (!here) {
          setError("Location permission is needed to find nearby weather.");
          return;
        }
        setCoords(here);
        const box = boundingBoxAround(here.lat, here.lon, radiusNm);
        const keySuffix = `${bucket(here.lat)},${bucket(here.lon)},${radiusNm}`;

        const [metarRes, advisoryRes, pirepRes] = await Promise.all([
          staleWhileRevalidate(userDb, `nearby-metar:${keySuffix}`, () => fetchMetarsByBbox(box), (fresh) =>
            setMetars(fresh)
          ),
          staleWhileRevalidate(userDb, `nearby-airsigmet:${keySuffix}`, () => fetchAirSigmetsByBbox(box), (fresh) =>
            setAdvisories(fresh)
          ),
          staleWhileRevalidate(userDb, `nearby-pirep:${keySuffix}`, () => fetchPirepsByBbox(box), (fresh) =>
            setPireps(fresh)
          ),
        ]);

        setMetars(metarRes);
        setAdvisories(advisoryRes);
        setPireps(pirepRes);
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err));
      } finally {
        setLoading(false);
      }
    },
    [locate, userDb]
  );

  // Load automatically as soon as this is mounted, at the default radius —
  // no tap needed. Deliberately excludes `load`/`radius` from deps: this
  // should fire exactly once per mount, not on every re-render.
  useEffect(() => {
    load(radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRadiusAndReload = useCallback(
    (r: NearbyRadius) => {
      setRadius(r);
      load(r);
    },
    [load]
  );

  const refresh = useCallback(() => {
    if (!loading) load(radius);
  }, [load, loading, radius]);

  const rows = useMemo<NearbyRow[]>(() => {
    if (!coords) return [];
    const metarRows: NearbyRow[] = (metars?.data ?? [])
      .filter((m): m is Metar & { lat: number; lon: number } => m.lat != null && m.lon != null)
      .map((m) => ({ key: `metar-${m.icaoId}`, data: m, dist: distanceNm(coords.lat, coords.lon, m.lat, m.lon) }))
      .sort((a, b) => a.dist - b.dist)
      .map(({ key, data, dist }): NearbyRow => ({ kind: "metar", key, data, dist }));

    const advisoryRows: NearbyRow[] = (advisories?.data ?? []).map(
      (a, i): NearbyRow => ({ kind: "airsigmet", key: `airsigmet-${i}`, data: a, dist: null })
    );

    const pirepRows: NearbyRow[] = (pireps?.data ?? [])
      .map((p, i): NearbyRow => {
        const dist = p.lat != null && p.lon != null ? distanceNm(coords.lat, coords.lon, p.lat, p.lon) : null;
        return { kind: "pirep", key: `pirep-${i}`, data: p, dist };
      })
      .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

    return [...metarRows, ...advisoryRows, ...pirepRows];
  }, [coords, metars, advisories, pireps]);

  const meta = useMemo(() => {
    if (!metars) return null;
    return {
      fetchedAt: metars.fetchedAt,
      stale: metars.stale || (advisories?.stale ?? false) || (pireps?.stale ?? false),
      offline: metars.offline || (advisories?.offline ?? false) || (pireps?.offline ?? false),
    };
  }, [metars, advisories, pireps]);

  return { radius, setRadius: setRadiusAndReload, loading, error, rows, meta, refresh };
}

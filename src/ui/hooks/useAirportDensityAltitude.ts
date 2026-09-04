import { useEffect, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { fetchMetarsByBbox, fetchMetarsByIds } from "../../weather/api";
import { staleWhileRevalidate } from "../../weather/cache";
import { boundingBoxAround, distanceNm } from "../../weather/distance";
import type { Metar } from "../../weather/types";
import { densityAltitude, isaStandardTempC, pressureAltitude } from "../../performance/calculations";

// Widened progressively until a reporting station turns up — most airports
// without their own METAR still have one within 50nm, but sparser areas
// (mountains, remote strips) need the wider fallback.
const FALLBACK_RADII_NM = [50, 150] as const;

export interface AirportDensityAltitude {
  metar: Metar;
  /** null when `metar` is this airport's own report; otherwise how far away the reporting station is. */
  sourceDistanceNm: number | null;
  altimeterInHg: number;
  pressureAltitudeFt: number;
  densityAltitudeFt: number;
  fetchedAt: number;
  stale: boolean;
  offline: boolean;
}

export interface AirportDensityAltitudeParams {
  ident: string;
  lat: number;
  lon: number;
  elevationFt: number;
}

/**
 * Pressure/density altitude for one airport, computed from its own current
 * METAR when it reports one, otherwise the nearest reporting station within
 * FALLBACK_RADII_NM. Elevation comes from the airport record; altimeter and
 * temperature come from whichever METAR ends up used, so callers should show
 * `sourceDistanceNm` when it's non-null to make clear the reading isn't from
 * the field itself.
 */
export function useAirportDensityAltitude(userDb: SQLiteDatabase, params: AirportDensityAltitudeParams | null) {
  const [result, setResult] = useState<AirportDensityAltitude | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params) {
      setResult(null);
      setError(null);
      return;
    }
    const { ident, lat, lon, elevationFt } = params;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const own = await staleWhileRevalidate(userDb, `metar:${ident}`, () => fetchMetarsByIds([ident]));
        let metar: Metar | undefined = own.data[0];
        let sourceDistanceNm: number | null = null;
        let fetchedAt = own.fetchedAt;
        let stale = own.stale;
        let offline = own.offline;

        if (!metar || metar.altim == null) {
          metar = undefined;
          for (const radius of FALLBACK_RADII_NM) {
            const box = boundingBoxAround(lat, lon, radius);
            const nearby = await staleWhileRevalidate(userDb, `airport-metar-bbox:${ident}:${radius}`, () =>
              fetchMetarsByBbox(box)
            );
            const withCoords = nearby.data.filter(
              (m): m is Metar & { lat: number; lon: number } => m.lat != null && m.lon != null && m.altim != null
            );
            if (withCoords.length === 0) continue;
            const nearest = withCoords
              .map((m) => ({ m, dist: distanceNm(lat, lon, m.lat, m.lon) }))
              .sort((a, b) => a.dist - b.dist)[0];
            metar = nearest.m;
            sourceDistanceNm = nearest.dist;
            fetchedAt = nearby.fetchedAt;
            stale = nearby.stale;
            offline = nearby.offline;
            break;
          }
        }

        if (cancelled) return;
        if (!metar || metar.altim == null || metar.temp == null) {
          setResult(null);
          setError(`No current METAR with altimeter and temperature found within ${FALLBACK_RADII_NM.at(-1)} nm.`);
          return;
        }

        const altimeterInHg = metar.altim * 0.02953;
        const pa = pressureAltitude(elevationFt, altimeterInHg);
        const stdTemp = isaStandardTempC(elevationFt);
        const da = densityAltitude(pa, stdTemp, metar.temp);

        setResult({
          metar,
          sourceDistanceNm,
          altimeterInHg,
          pressureAltitudeFt: pa,
          densityAltitudeFt: da,
          fetchedAt,
          stale,
          offline,
        });
      } catch (err) {
        if (!cancelled) {
          setResult(null);
          setError(String(err instanceof Error ? err.message : err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userDb, params?.ident, params?.lat, params?.lon, params?.elevationFt]);

  return { result, loading, error };
}

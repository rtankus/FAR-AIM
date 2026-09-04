import { distanceNm } from "../weather/distance";
import type { GeoJsonGeometry, Tfr } from "./types";

function ringsOf(geom: GeoJsonGeometry): number[][][] {
  // Coordinates are [lon, lat] pairs, per GeoJSON. MultiPolygon nests one
  // level deeper than Polygon (a list of polygons, each a list of rings) —
  // flatten that outer level so both shapes yield the same list of rings.
  return geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
}

/**
 * Approximate distance from a point to a TFR's area, in nautical miles: the
 * minimum distance to any vertex of its polygon(s). This can slightly
 * overestimate distance to a point well inside a large TFR (whose nearest
 * true edge falls between two vertices), but TFRs are typically only a few
 * nautical miles across, so it's a fine approximation for "roughly how far
 * is this" filtering and sorting.
 */
export function tfrDistanceNm(tfr: Tfr, lat: number, lon: number): number {
  let min = Infinity;
  for (const ring of ringsOf(tfr.geometry)) {
    for (const [vLon, vLat] of ring) {
      const d = distanceNm(lat, lon, vLat, vLon);
      if (d < min) min = d;
    }
  }
  return min;
}

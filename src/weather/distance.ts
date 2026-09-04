import type { BoundingBox } from "./types";

const EARTH_RADIUS_NM = 3440.065;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two lat/lon points, in nautical miles. */
export function distanceNm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * A lat/lon bounding box around a center point wide enough to cover
 * `radiusNm` in every direction. Longitude degrees shrink toward the poles,
 * so that axis is widened to compensate.
 */
export function boundingBoxAround(lat: number, lon: number, radiusNm: number): BoundingBox {
  const latDelta = radiusNm / 60; // 1 degree latitude ~= 60nm
  const lonDelta = radiusNm / (60 * Math.max(0.15, Math.cos(toRad(lat))));
  return {
    minLat: Math.max(-90, lat - latDelta),
    maxLat: Math.min(90, lat + latDelta),
    minLon: Math.max(-180, lon - lonDelta),
    maxLon: Math.min(180, lon + lonDelta),
  };
}

/** Formats a bbox as the API's expected "minLat,minLon,maxLat,maxLon". */
export function bboxParam(box: BoundingBox): string {
  return `${box.minLat.toFixed(4)},${box.minLon.toFixed(4)},${box.maxLat.toFixed(4)},${box.maxLon.toFixed(4)}`;
}

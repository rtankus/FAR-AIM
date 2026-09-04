// Shapes for the FAA's NMS-API (NOTAM Management Service), GEOJSON response
// format. Confirmed against live responses from the pre-prod/staging
// environment — see auth.ts for why staging, not production.
export interface NotamTranslation {
  type: string | null; // "LOCAL_FORMAT" | "ICAO"
  simpleText?: string | null;
  formattedText?: string | null;
}

export interface Notam {
  id: string;
  number: string | null;
  year: string | null;
  type: string | null; // N (new), C (cancel), R (replace)...
  location: string | null;
  icaoLocation: string | null;
  issued: string | null;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  text: string | null;
  classification: string | null; // INTL, MILITARY, LOCAL_MILITARY, DOMESTIC, FDC
  accountId: string | null;
  lastUpdated: string | null;
  schedule?: string | null;
  lat?: number | null;
  lon?: number | null;
  notamTranslation?: NotamTranslation[] | null;
  [key: string]: unknown;
}

interface NotamGeoJsonFeature {
  type: "Feature";
  properties: {
    coreNOTAMData: {
      notam: Notam;
      notamTranslation?: NotamTranslation[];
    };
  };
  geometry?: {
    type: string;
    geometries?: { type: string; coordinates: unknown }[];
  };
}

export interface NmsNotamResponse {
  status: string;
  data: {
    geojson?: NotamGeoJsonFeature[];
    url?: string;
  };
}

/**
 * Flattens a GEOJSON feature into a Notam: pulls the sibling notamTranslation
 * array onto the notam object, and a point lat/lon out of its geometry if
 * present.
 */
export function notamFromFeature(feature: NotamGeoJsonFeature): Notam {
  const { notam, notamTranslation } = feature.properties.coreNOTAMData;
  const point = feature.geometry?.geometries?.find((g) => g.type === "Point");
  const coords = point?.coordinates;
  const withLatLon =
    Array.isArray(coords) && coords.length >= 2 ? { lon: coords[0] as number, lat: coords[1] as number } : {};
  return { ...notam, ...withLatLon, notamTranslation: notamTranslation ?? notam.notamTranslation ?? null };
}

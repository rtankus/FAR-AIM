// Shapes for aviationweather.gov's Data API (https://aviationweather.gov/data/api).
// Only the fields we actually use are typed; everything else passes through
// via the index signature so an unrecognized/renamed field never breaks
// parsing — the raw report text (rawOb/rawTaf) is always shown regardless of
// how the structured fields come back.

export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR" | (string & {});

export interface CloudLayer {
  cover: string; // SKC, FEW, SCT, BKN, OVC, VV...
  base: number | null; // feet AGL
}

export interface Metar {
  icaoId: string;
  rawOb: string;
  obsTime: number | null; // unix seconds
  reportTime: string | null;
  temp: number | null; // Celsius
  dewp: number | null;
  wdir: number | string | null; // degrees, or "VRB"
  wspd: number | null; // knots
  wgst: number | null;
  visib: number | string | null; // statute miles, or "10+"
  altim: number | null; // hPa
  wxString: string | null;
  clouds: CloudLayer[] | null;
  fltCat: FlightCategory | null;
  lat: number | null;
  lon: number | null;
  name: string | null;
  [key: string]: unknown;
}

export interface TafForecastPeriod {
  timeFrom: number | null;
  timeTo: number | null;
  fcstChange: string | null; // FM, TEMPO, BECMG, PROB30...
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  visib: number | string | null;
  wxString: string | null;
  clouds: CloudLayer[] | null;
  [key: string]: unknown;
}

export interface Taf {
  icaoId: string;
  rawTAF: string;
  issueTime: string | null;
  validTimeFrom: number | null;
  validTimeTo: number | null;
  fcsts: TafForecastPeriod[] | null;
  lat: number | null;
  lon: number | null;
  [key: string]: unknown;
}

export interface AirSigmet {
  airSigmetType: string | null; // AIRMET / SIGMET
  hazard: string | null; // TURB, ICE, IFR, MTN OBSC, CONVECTIVE...
  severity: string | null;
  rawAirSigmet: string | null;
  validTimeFrom: number | null;
  validTimeTo: number | null;
  // Polygon (or point) the advisory covers, as [lon, lat] pairs.
  coords: { lat: number; lon: number }[] | null;
  [key: string]: unknown;
}

export interface Pirep {
  receiptTime: string | null;
  obsTime: number | null;
  icaoId: string | null;
  lat: number | null;
  lon: number | null;
  fltLvl: number | null;
  aircraftRef: string | null;
  turbulence: string | null;
  icing: string | null;
  wxString: string | null;
  rawOb: string;
  [key: string]: unknown;
}

export interface BoundingBox {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

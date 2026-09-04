export interface Airport {
  ident: string;
  name: string;
  lat: number;
  lon: number;
  elev_ft: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  type: string;
}

export interface Runway {
  airport_ident: string;
  ident: string;
  length_ft: number | null;
  width_ft: number | null;
  surface: string | null;
}

export type ProcedureType = "SID" | "STAR" | "APPROACH";

export interface Procedure {
  airport_ident: string;
  name: string;
  type: ProcedureType;
}

/**
 * Waypoint description code (ARINC 424 field 5.17, character 1) — flags
 * why a fix is significant on the procedure, when the FAA's CIFP coding
 * bothers to flag it at all (most fixes carry no flag).
 */
export type WaypointDesc = "IAF" | "IAF_HOLD" | "IF" | "FAF" | "HOLD" | "MAP";

export const WAYPOINT_DESC_LABEL: Record<WaypointDesc, string> = {
  IAF: "IAF",
  IAF_HOLD: "IAF (Hold)",
  IF: "IF",
  FAF: "FAF",
  HOLD: "Hold",
  MAP: "MAP",
};

/**
 * ARINC 424 path terminator (field 5.19, cols 48-49 in CIFP's fixed-width
 * procedure leg records) — the leg's geometry type, which also doubles as
 * useful plate text (e.g. "IF" legs mark a transition's starting fix).
 * Not exhaustive — codes not in this table are shown as-is.
 */
export const PATH_TERMINATOR_LABEL: Record<string, string> = {
  IF: "Initial Fix",
  TF: "Track to Fix",
  CF: "Course to Fix",
  DF: "Direct to Fix",
  FA: "Fix to Altitude",
  FC: "Fix to Distance",
  FD: "Fix to DME Distance",
  FM: "Fix to Manual Termination",
  CA: "Course to Altitude",
  CD: "Course to DME Distance",
  CI: "Course to Intercept",
  CR: "Course to Radial Termination",
  VA: "Heading to Altitude",
  VD: "Heading to DME Distance",
  VI: "Heading to Intercept",
  VM: "Heading to Manual Termination",
  VR: "Heading to Radial",
  AF: "Arc to Fix",
  RF: "Constant Radius Arc",
  HA: "Holding to Altitude",
  HF: "Holding, Single Circuit",
  HM: "Holding, Manual Termination",
  PI: "Procedure Turn",
};

/** One fix along one transition of one SID/STAR/approach — the "plate" text. */
export interface ProcedureLeg {
  airport_ident: string;
  type: ProcedureType;
  name: string;
  route_type: string | null;
  transition_ident: string;
  seq: number;
  fix_ident: string | null;
  path_terminator: string | null;
  desc_code: WaypointDesc | null;
  /** '+' at/above, '-' at/below, '@' at, 'B' window (alt1..alt2) — null if this leg carries no altitude restriction. */
  alt_desc: "+" | "-" | "@" | "B" | null;
  alt1: number | null;
  alt2: number | null;
}

export interface Frequency {
  airport_ident: string;
  type: string;
  freq_mhz: number;
  name: string | null;
}

/** An official FAA d-TPP chart PDF (approach/departure/arrival/airport diagram) — link only, not the file itself. */
export interface ProcedureChart {
  airport_ident: string;
  /** IAP (approach), DP (departure/SID), STAR (arrival), or APD (airport diagram). */
  chart_code: "IAP" | "DP" | "STAR" | "APD";
  chart_name: string;
  pdf_url: string;
}

export const CHART_CODE_LABEL: Record<ProcedureChart["chart_code"], string> = {
  IAP: "Approach",
  DP: "Departure",
  STAR: "Arrival",
  APD: "Airport Diagram",
};

/** Shape written by airports-pipeline/scripts/build-db.mjs. */
export interface AirportsManifest {
  version: string;
  builtAt: string;
  sha256: string;
  sizeBytes: number;
  airportCount: number;
  runwayCount: number;
  procedureCount: number;
  procedureLegCount: number;
  chartCount: number;
  navaidCount: number;
  frequencyCount: number;
  downloadUrl: string;
}

export interface Navaid {
  ident: string;
  name: string | null;
  type: string | null;
  lat: number;
  lon: number;
  freq_khz: number | null;
}

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

export interface Frequency {
  airport_ident: string;
  type: string;
  freq_mhz: number;
  name: string | null;
}

/** Shape written by airports-pipeline/scripts/build-db.mjs. */
export interface AirportsManifest {
  version: string;
  builtAt: string;
  sha256: string;
  sizeBytes: number;
  airportCount: number;
  runwayCount: number;
  procedureCount: number;
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

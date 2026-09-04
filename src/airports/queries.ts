import type { SQLiteDatabase } from "expo-sqlite";
import type { BoundingBox } from "../weather/types";
import type { Airport, Frequency, Navaid, Procedure, ProcedureLeg, ProcedureType, Runway } from "./types";

/**
 * Airports whose lat/lon falls in `box` — a cheap indexed bbox prefilter;
 * callers do the exact haversine distance/sort themselves (same split as
 * useNearbyWeather's fetchMetarsByBbox). This is a local bundled db (see
 * db/airportsDatabase.ts), so there's no network/offline concern here.
 */
export async function airportsInBbox(db: SQLiteDatabase, box: BoundingBox): Promise<Airport[]> {
  return db.getAllAsync<Airport>(
    `SELECT * FROM airports WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
    [box.minLat, box.maxLat, box.minLon, box.maxLon]
  );
}

export async function navaidsInBbox(db: SQLiteDatabase, box: BoundingBox): Promise<Navaid[]> {
  return db.getAllAsync<Navaid>(
    `SELECT * FROM navaids WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?`,
    [box.minLat, box.maxLat, box.minLon, box.maxLon]
  );
}

export async function getAirport(db: SQLiteDatabase, ident: string): Promise<Airport | null> {
  return db.getFirstAsync<Airport>(`SELECT * FROM airports WHERE ident = ?`, [ident.toUpperCase()]);
}

export async function getRunways(db: SQLiteDatabase, airportIdent: string): Promise<Runway[]> {
  return db.getAllAsync<Runway>(`SELECT * FROM runways WHERE airport_ident = ? ORDER BY length_ft DESC`, [
    airportIdent.toUpperCase(),
  ]);
}

export async function getProcedures(db: SQLiteDatabase, airportIdent: string): Promise<Procedure[]> {
  return db.getAllAsync<Procedure>(`SELECT * FROM procedures WHERE airport_ident = ? ORDER BY type, name`, [
    airportIdent.toUpperCase(),
  ]);
}

export async function getFrequencies(db: SQLiteDatabase, airportIdent: string): Promise<Frequency[]> {
  return db.getAllAsync<Frequency>(`SELECT * FROM frequencies WHERE airport_ident = ? ORDER BY type`, [
    airportIdent.toUpperCase(),
  ]);
}

/** All legs of every transition of one procedure (e.g. one SID), ordered so grouping by transition_ident and taking them in order reconstructs each transition's fix sequence. */
export async function getProcedureLegs(
  db: SQLiteDatabase,
  airportIdent: string,
  type: ProcedureType,
  name: string
): Promise<ProcedureLeg[]> {
  return db.getAllAsync<ProcedureLeg>(
    `SELECT * FROM procedure_legs WHERE airport_ident = ? AND type = ? AND name = ? ORDER BY transition_ident, seq`,
    [airportIdent.toUpperCase(), type, name]
  );
}

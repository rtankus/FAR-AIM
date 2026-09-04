import type { SQLiteDatabase } from "expo-sqlite";
import {
  deletePerfProfileRow,
  getPerfProfileRow,
  listPerfProfileRows,
  setPerfProfileRow,
} from "../db/userdb";
import type { AircraftProfile } from "./types";

export async function listProfiles(userDb: SQLiteDatabase): Promise<AircraftProfile[]> {
  const rows = await listPerfProfileRows(userDb);
  return rows.map((r) => JSON.parse(r.payload) as AircraftProfile);
}

export async function getProfile(userDb: SQLiteDatabase, id: string): Promise<AircraftProfile | null> {
  const payload = await getPerfProfileRow(userDb, id);
  return payload ? (JSON.parse(payload) as AircraftProfile) : null;
}

export async function saveProfile(userDb: SQLiteDatabase, profile: AircraftProfile): Promise<void> {
  await setPerfProfileRow(userDb, profile.id, profile.name, JSON.stringify(profile));
}

export async function deleteProfile(userDb: SQLiteDatabase, id: string): Promise<void> {
  await deletePerfProfileRow(userDb, id);
}

export function newProfileId(): string {
  return `aircraft:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

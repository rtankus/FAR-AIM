import type { SQLiteDatabase } from "expo-sqlite";
import {
  deletePerfProfileRow,
  getPerfProfileRow,
  getSetting,
  listPerfProfileRows,
  setPerfProfileRow,
  setSetting,
} from "../db/userdb";
import { SEED_PROFILES } from "./seedProfiles";
import type { AircraftProfile } from "./types";

const SEEDED_FLAG_KEY = "perfProfilesSeededV1";

/**
 * One-time seed of the aircraft profiles ported from the user's own W&B
 * spreadsheet, so they don't have to retype BEW/arms/etc. by hand. Runs
 * exactly once ever (tracked in meta, same pattern as the legacy-data
 * migration) — after that, deleting a seeded profile stays deleted rather
 * than reappearing on next launch.
 */
export async function ensureSeedProfiles(userDb: SQLiteDatabase): Promise<void> {
  const done = await getSetting(userDb, SEEDED_FLAG_KEY);
  if (done) return;
  const now = Date.now();
  for (const profile of SEED_PROFILES) {
    await setPerfProfileRow(userDb, profile.id, profile.name, JSON.stringify({ ...profile, createdAt: now, updatedAt: now }));
  }
  await setSetting(userDb, SEEDED_FLAG_KEY, "1");
}

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

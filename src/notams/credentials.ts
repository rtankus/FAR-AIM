import type { SQLiteDatabase } from "expo-sqlite";
import { getSetting, setSetting } from "../db/userdb";

// Stored in the user database, not hardcoded in source — this is a
// per-account credential from the FAA/CGI NMS-API onboarding process.
const CLIENT_ID_KEY = "nmsNotamClientId";
const CLIENT_SECRET_KEY = "nmsNotamClientSecret";

export interface NotamCredentials {
  clientId: string;
  clientSecret: string;
}

export async function getNotamCredentials(userDb: SQLiteDatabase): Promise<NotamCredentials | null> {
  const [clientId, clientSecret] = await Promise.all([
    getSetting(userDb, CLIENT_ID_KEY),
    getSetting(userDb, CLIENT_SECRET_KEY),
  ]);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function setNotamCredentials(userDb: SQLiteDatabase, creds: NotamCredentials): Promise<void> {
  await setSetting(userDb, CLIENT_ID_KEY, creds.clientId.trim());
  await setSetting(userDb, CLIENT_SECRET_KEY, creds.clientSecret.trim());
}

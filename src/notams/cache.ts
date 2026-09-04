import type { SQLiteDatabase } from "expo-sqlite";
import * as Network from "expo-network";
import { getNotamCacheEntry, setNotamCacheEntry } from "../db/userdb";
import { NotamCredentialsMissingError } from "./api";
import type { Notam } from "./types";

export interface CachedResult<T> {
  data: T;
  fetchedAt: number;
  stale: boolean;
  offline: boolean;
}

async function looksOnline(): Promise<boolean> {
  const net = await Network.getNetworkStateAsync().catch(() => null);
  return net ? !!net.isConnected && net.isInternetReachable !== false : true;
}

/**
 * Stale-while-revalidate cache for NOTAM lookups, same shape as the
 * weather/TFR caches: whatever's cached under `key` paints immediately, and
 * (if online) a background fetch quietly replaces it via `onFresh`. Missing
 * API credentials are NOT treated as a routine offline failure — that error
 * is rethrown as-is so the UI can point at Settings instead of just showing
 * a stale banner.
 */
export async function staleWhileRevalidateNotams(
  userDb: SQLiteDatabase,
  key: string,
  fetcher: () => Promise<Notam[]>,
  onFresh?: (result: CachedResult<Notam[]>) => void
): Promise<CachedResult<Notam[]>> {
  const cached = await getNotamCacheEntry(userDb, key);
  const online = await looksOnline();

  if (!cached) {
    if (!online) throw new Error("Offline, and no NOTAMs are cached for this yet.");
    try {
      const data = await fetcher();
      await setNotamCacheEntry(userDb, key, JSON.stringify(data));
      return { data, fetchedAt: Date.now(), stale: false, offline: false };
    } catch (err) {
      if (err instanceof NotamCredentialsMissingError) throw err;
      throw err;
    }
  }

  if (online) {
    fetcher()
      .then(async (data) => {
        await setNotamCacheEntry(userDb, key, JSON.stringify(data));
        onFresh?.({ data, fetchedAt: Date.now(), stale: false, offline: false });
      })
      .catch((err) => {
        // A background refresh failing (including missing credentials,
        // which can't happen mid-flow since the initial fetch already
        // needed them) isn't worth surfacing over the cached value below.
        void err;
      });
  }

  return { data: JSON.parse(cached.payload) as Notam[], fetchedAt: cached.fetchedAt, stale: true, offline: !online };
}

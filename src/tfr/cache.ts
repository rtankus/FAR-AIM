import type { SQLiteDatabase } from "expo-sqlite";
import * as Network from "expo-network";
import { getTfrCacheEntry, setTfrCacheEntry } from "../db/userdb";
import type { Tfr } from "./types";

const CACHE_KEY = "active";

export interface CachedResult<T> {
  data: T;
  /** When this data was actually fetched from the FAA. */
  fetchedAt: number;
  /** True if this came from the on-device cache rather than a fresh fetch. */
  stale: boolean;
  /** True if we know there's no connectivity right now (vs. just not refreshed yet). */
  offline: boolean;
}

async function looksOnline(): Promise<boolean> {
  const net = await Network.getNetworkStateAsync().catch(() => null);
  return net ? !!net.isConnected && net.isInternetReachable !== false : true;
}

/**
 * Read-through cache for the active-TFR list: fetch fresh when online,
 * otherwise fall back to the last-known list if the connection is down or
 * the request fails. Every successful fetch overwrites the cache, so the
 * fallback is always the most recent list seen.
 */
export async function cachedFetchTfrs(
  userDb: SQLiteDatabase,
  fetcher: () => Promise<Tfr[]>
): Promise<CachedResult<Tfr[]>> {
  const online = await looksOnline();

  if (online) {
    try {
      const data = await fetcher();
      await setTfrCacheEntry(userDb, CACHE_KEY, JSON.stringify(data));
      return { data, fetchedAt: Date.now(), stale: false, offline: false };
    } catch (err) {
      const cached = await getTfrCacheEntry(userDb, CACHE_KEY);
      if (cached) {
        return { data: JSON.parse(cached.payload) as Tfr[], fetchedAt: cached.fetchedAt, stale: true, offline: false };
      }
      throw err;
    }
  }

  const cached = await getTfrCacheEntry(userDb, CACHE_KEY);
  if (cached) {
    return { data: JSON.parse(cached.payload) as Tfr[], fetchedAt: cached.fetchedAt, stale: true, offline: true };
  }
  throw new Error("Offline, and no TFR data is cached on this device yet.");
}

/**
 * Stale-while-revalidate sibling of `cachedFetchTfrs` — same idea as
 * src/weather/cache.ts's version: return the cached list immediately if one
 * exists, and (if online) refresh it in the background, delivering the
 * result via `onFresh` without making the caller wait for it.
 */
export async function staleWhileRevalidateTfrs(
  userDb: SQLiteDatabase,
  fetcher: () => Promise<Tfr[]>,
  onFresh?: (result: CachedResult<Tfr[]>) => void
): Promise<CachedResult<Tfr[]>> {
  const cached = await getTfrCacheEntry(userDb, CACHE_KEY);
  if (!cached) return cachedFetchTfrs(userDb, fetcher);

  const online = await looksOnline();
  if (online) {
    fetcher()
      .then(async (data) => {
        await setTfrCacheEntry(userDb, CACHE_KEY, JSON.stringify(data));
        onFresh?.({ data, fetchedAt: Date.now(), stale: false, offline: false });
      })
      .catch(() => {
        // The cached value already handed back below stands.
      });
  }

  return { data: JSON.parse(cached.payload) as Tfr[], fetchedAt: cached.fetchedAt, stale: true, offline: !online };
}

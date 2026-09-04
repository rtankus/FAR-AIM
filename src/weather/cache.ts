import type { SQLiteDatabase } from "expo-sqlite";
import * as Network from "expo-network";
import { getWeatherCacheEntry, setWeatherCacheEntry } from "../db/userdb";

export interface CachedResult<T> {
  data: T;
  /** When this data was actually fetched from aviationweather.gov. */
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
 * Read-through cache for weather lookups, built for spotty in-flight
 * connectivity: try the network first, and only fall back to whatever was
 * last cached under `key` if the connection is down or the request fails.
 * Every successful fetch overwrites the cache, so the fallback is always the
 * most recent data seen — not necessarily fresh, but never wrong.
 */
export async function cachedFetch<T>(
  userDb: SQLiteDatabase,
  key: string,
  fetcher: () => Promise<T>
): Promise<CachedResult<T>> {
  const online = await looksOnline();

  if (online) {
    try {
      const data = await fetcher();
      await setWeatherCacheEntry(userDb, key, JSON.stringify(data));
      return { data, fetchedAt: Date.now(), stale: false, offline: false };
    } catch (err) {
      const cached = await getWeatherCacheEntry(userDb, key);
      if (cached) {
        return { data: JSON.parse(cached.payload) as T, fetchedAt: cached.fetchedAt, stale: true, offline: false };
      }
      throw err;
    }
  }

  const cached = await getWeatherCacheEntry(userDb, key);
  if (cached) {
    return { data: JSON.parse(cached.payload) as T, fetchedAt: cached.fetchedAt, stale: true, offline: true };
  }
  throw new Error("Offline, and no cached data is saved for this yet.");
}

/**
 * Stale-while-revalidate: if anything is cached, return it immediately (so a
 * screen can paint right away instead of waiting on a network round trip)
 * and — if online — kick off a background refresh whose result arrives via
 * `onFresh` whenever it lands, without blocking this call. Falls back to
 * `cachedFetch`'s wait-for-network behavior when there's nothing cached yet.
 */
export async function staleWhileRevalidate<T>(
  userDb: SQLiteDatabase,
  key: string,
  fetcher: () => Promise<T>,
  onFresh?: (result: CachedResult<T>) => void
): Promise<CachedResult<T>> {
  const cached = await getWeatherCacheEntry(userDb, key);
  if (!cached) return cachedFetch(userDb, key, fetcher);

  const online = await looksOnline();
  if (online) {
    fetcher()
      .then(async (data) => {
        await setWeatherCacheEntry(userDb, key, JSON.stringify(data));
        onFresh?.({ data, fetchedAt: Date.now(), stale: false, offline: false });
      })
      .catch(() => {
        // The cached value already handed back below stands — a failed
        // background refresh isn't worth surfacing as an error.
      });
  }

  return { data: JSON.parse(cached.payload) as T, fetchedAt: cached.fetchedAt, stale: true, offline: !online };
}

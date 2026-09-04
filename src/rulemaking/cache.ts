import type { SQLiteDatabase } from "expo-sqlite";
import * as Network from "expo-network";
import { getRulemakingCacheEntry, setRulemakingCacheEntry } from "../db/userdb";
import type { RulemakingDocument } from "./types";

type RulemakingResult = RulemakingDocument[];

// The FAA publishes new rulemaking on business days at most, so there's no
// point re-fetching more than once a day — refetching immediately on every
// Home screen visit would just hit the network for identical data.
const MAX_AGE_MS = 20 * 60 * 60 * 1000;

export interface CachedResult<T> {
  data: T;
  /** When this data was actually fetched from federalregister.gov. */
  fetchedAt: number;
  /** True if this came from the on-device cache rather than a fresh fetch. */
  stale: boolean;
}

/**
 * Read-through, once-a-day cache for the FAA rulemaking feed. Serves a
 * same-day cache hit without touching the network; otherwise fetches fresh
 * and falls back to whatever was last cached if the connection is down or
 * the request fails.
 */
export async function cachedFetchRulemaking(
  userDb: SQLiteDatabase,
  limit: number,
  fetcher: () => Promise<RulemakingResult>
): Promise<CachedResult<RulemakingResult>> {
  // Keyed by limit so the Home screen's small preview fetch and the full
  // list screen's larger fetch don't clobber each other's cache entry.
  const cacheKey = `faa-recent:${limit}`;
  const cached = await getRulemakingCacheEntry(userDb, cacheKey);
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) {
    return { data: JSON.parse(cached.payload) as RulemakingResult, fetchedAt: cached.fetchedAt, stale: false };
  }

  const net = await Network.getNetworkStateAsync().catch(() => null);
  const looksOnline = net ? net.isConnected && net.isInternetReachable !== false : true;

  if (looksOnline) {
    try {
      const data = await fetcher();
      await setRulemakingCacheEntry(userDb, cacheKey, JSON.stringify(data));
      return { data, fetchedAt: Date.now(), stale: false };
    } catch (err) {
      if (cached) return { data: JSON.parse(cached.payload) as RulemakingResult, fetchedAt: cached.fetchedAt, stale: true };
      throw err;
    }
  }

  if (cached) return { data: JSON.parse(cached.payload) as RulemakingResult, fetchedAt: cached.fetchedAt, stale: true };
  throw new Error("Offline, and no cached rulemaking data is saved for this yet.");
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as SQLite from "expo-sqlite";
import { AIRPORTS_DB_NAME, ensureAirportsDbInstalled } from "../db/airportsDatabase";

interface AirportsDbValue {
  db: SQLite.SQLiteDatabase | null;
  /** Closes the current connection — call before swapping in a downloaded update. */
  close: () => Promise<void>;
  /** (Re)opens airports.db from disk — call after applying an update, or after close(). */
  reopen: () => Promise<void>;
}

const AirportsDbContext = createContext<AirportsDbValue>({
  db: null,
  close: async () => {},
  reopen: async () => {},
});

/**
 * The bundled US airports/runways/procedures/frequencies/navaids database
 * (see src/airports/, db/airportsDatabase.ts). Returns null until the
 * first-launch asset copy + open finishes — callers that need it
 * unconditionally (e.g. a screen only reachable once the tree has mounted)
 * can treat null as "still loading" without a separate loading screen,
 * since unlike faraim.db this data isn't needed for the app's very first
 * frame.
 */
export function useAirportsDb(): SQLite.SQLiteDatabase | null {
  return useContext(AirportsDbContext).db;
}

/**
 * { close, reopen } for SettingsScreen's update flow: close() before
 * swapping the on-disk file (a SQLite connection shouldn't have its
 * underlying file replaced out from under it), reopen() after.
 */
export function useReloadAirportsDb(): { close: () => Promise<void>; reopen: () => Promise<void> } {
  const { close, reopen } = useContext(AirportsDbContext);
  return { close, reopen };
}

export function AirportsDbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  // Guards against the open-on-mount effect and a manual reopen() racing.
  const openingRef = useRef(false);

  const reopen = useCallback(async () => {
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      await ensureAirportsDbInstalled();
      const opened = await SQLite.openDatabaseAsync(AIRPORTS_DB_NAME);
      dbRef.current = opened;
      setDb(opened);
    } finally {
      openingRef.current = false;
    }
  }, []);

  const close = useCallback(async () => {
    if (dbRef.current) {
      await dbRef.current.closeAsync();
      dbRef.current = null;
      setDb(null);
    }
  }, []);

  useEffect(() => {
    reopen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AirportsDbContext.Provider value={{ db, close, reopen }}>{children}</AirportsDbContext.Provider>;
}

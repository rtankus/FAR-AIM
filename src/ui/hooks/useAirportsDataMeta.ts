import { useEffect, useState } from "react";
import { useAirportsDb } from "../AirportsDbContext";
import { getInstalledAirportsVersion } from "../../db/airportsDatabase";

export interface AirportsDataMeta {
  version: string;
  builtAt: string;
}

/**
 * The installed airports.db's build date, re-read whenever the db is
 * reopened (including after useAutoUpdateAirportsData silently swaps in a
 * newer bundle) — lets any screen show "as of <date>" without duplicating
 * the getInstalledAirportsVersion() plumbing.
 */
export function useAirportsDataMeta(): AirportsDataMeta | null {
  const airportsDb = useAirportsDb();
  const [meta, setMeta] = useState<AirportsDataMeta | null>(null);

  useEffect(() => {
    if (!airportsDb) return;
    let cancelled = false;
    getInstalledAirportsVersion(airportsDb).then((m) => {
      if (!cancelled) setMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, [airportsDb]);

  return meta;
}

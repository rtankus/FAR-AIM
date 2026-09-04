import { useEffect, useRef } from "react";
import * as Network from "expo-network";
import { useUserDb } from "../UserDbContext";
import { useAirportsDb, useReloadAirportsDb } from "../AirportsDbContext";
import { applyDownloadedAirportsUpdate, checkForAirportsUpdate, downloadAirportsUpdate } from "../../db/airportsDatabase";
import { getSetting, setSetting } from "../../db/userdb";

const LAST_CHECK_KEY = "airportsDataLastAutoCheckAt";
// The FAA cycle is ~28 days, so checking daily is already generous — this
// just avoids hitting GitHub's manifest on literally every cold start.
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Silently checks for a newer airports.db bundle once per app-launch-per-day
 * (see CHECK_INTERVAL_MS) and, if one's available and the device is online,
 * downloads and applies it in the background — no prompt, since this is
 * reference data (not user data) and the swap is safe to redo if interrupted.
 * Mounted once in AppShell, below every provider it needs.
 */
export function useAutoUpdateAirportsData(): void {
  const userDb = useUserDb();
  const airportsDb = useAirportsDb();
  const { close, reopen } = useReloadAirportsDb();
  const ranRef = useRef(false);

  useEffect(() => {
    if (!airportsDb || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const lastCheckedRaw = await getSetting(userDb, LAST_CHECK_KEY);
        const lastChecked = lastCheckedRaw ? Number(lastCheckedRaw) : 0;
        if (Date.now() - lastChecked < CHECK_INTERVAL_MS) return;

        const net = await Network.getNetworkStateAsync();
        if (!net.isConnected || net.isInternetReachable === false) return;

        const result = await checkForAirportsUpdate(airportsDb);
        await setSetting(userDb, LAST_CHECK_KEY, String(Date.now()));
        if (!result.updateAvailable) return;

        const tempFile = await downloadAirportsUpdate(result.remoteManifest);
        await close();
        try {
          await applyDownloadedAirportsUpdate(tempFile);
        } finally {
          await reopen();
        }
      } catch {
        // Silent by design — this is a background refresh of reference data,
        // not a user-initiated action. SettingsScreen's manual "Check for
        // Updates" surfaces failures for anyone who wants to see them.
      }
    })();
  }, [airportsDb, userDb, close, reopen]);
}

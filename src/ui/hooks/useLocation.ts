import { useCallback, useState } from "react";
import * as Location from "expo-location";

export interface Coords {
  lat: number;
  lon: number;
}

type Status = "idle" | "locating" | "done" | "denied" | "error";

/**
 * On-demand GPS fix — nothing is requested until `locate()` is called, and
 * permission is (re-)asked there too, so this is safe to mount on a screen
 * that isn't always used for location (e.g. a weather hub screen).
 */
export function useLocation() {
  const [status, setStatus] = useState<Status>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(async (): Promise<Coords | null> => {
    setStatus("locating");
    setError(null);
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        setStatus("denied");
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setCoords(next);
      setStatus("done");
      return next;
    } catch (err) {
      setStatus("error");
      setError(String(err instanceof Error ? err.message : err));
      return null;
    }
  }, []);

  return { status, coords, error, locate };
}

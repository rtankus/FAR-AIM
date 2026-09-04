import { useEffect, useState } from "react";
import { getOrCreateInstallDate } from "../../db/userdb";
import { useUserDb } from "../UserDbContext";

// A free Apple developer signing certificate expires 7 days after the
// build is installed from Xcode — the app then needs a fresh install from
// the laptop to keep running on the phone. There's no API to read the
// certificate's own expiry, so this counts 7 days from first launch, which
// lines up with it (see getOrCreateInstallDate).
const EXPIRY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECHECK_INTERVAL_MS = 60 * 60 * 1000; // re-derive hourly, in case the app is left open across midnight

export interface InstallExpiry {
  /** Whole days left before reinstall is needed, floored, clamped to >= 0. */
  daysRemaining: number;
  expired: boolean;
}

/** Null until the install date has been read/created. */
export function useInstallExpiry(): InstallExpiry | null {
  const userDb = useUserDb();
  const [installDate, setInstallDate] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const date = await getOrCreateInstallDate(userDb);
      if (!cancelled) setInstallDate(date);
    })();
    return () => {
      cancelled = true;
    };
  }, [userDb]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), RECHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (installDate == null) return null;

  const msRemaining = installDate + EXPIRY_DAYS * DAY_MS - now;
  // installDate is itself written by a Date.now() call a few ms after
  // `now`'s initial state capture (it's set inside an async effect), so
  // msRemaining can land a hair above EXPIRY_DAYS worth of ms — clamp the
  // ceil so that never rounds up to an 8th day.
  const daysRemaining = Math.min(EXPIRY_DAYS, Math.max(0, Math.ceil(msRemaining / DAY_MS)));
  return { daysRemaining, expired: msRemaining <= 0 };
}

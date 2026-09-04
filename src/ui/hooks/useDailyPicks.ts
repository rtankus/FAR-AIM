import { useEffect, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { countSectionsBySource, getSectionAtOffset } from "../../db/queries";
import type { Section } from "../../content/types";

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * One FAR section and one AC section to read today — deterministically
 * picked from the date, so they're stable all day (and pick something new
 * automatically tomorrow) with nothing to store: the same date always hashes
 * to the same pick.
 */
export function useDailyPicks(db: SQLiteDatabase) {
  const [farPick, setFarPick] = useState<Section | null>(null);
  const [acPick, setAcPick] = useState<Section | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = todayKey();
      const [farCount, acCount] = await Promise.all([
        countSectionsBySource(db, "FAR"),
        countSectionsBySource(db, "AC"),
      ]);
      const [far, ac] = await Promise.all([
        farCount > 0 ? getSectionAtOffset(db, "FAR", hashString(key + "FAR") % farCount) : null,
        acCount > 0 ? getSectionAtOffset(db, "AC", hashString(key + "AC") % acCount) : null,
      ]);
      if (!cancelled) {
        setFarPick(far);
        setAcPick(ac);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  return { farPick, acPick };
}

import { useCallback, useEffect, useState } from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { getSetting, setSetting } from "../../db/userdb";

const SETTING_KEY = "favoriteAirports";
const MAX_FAVORITES = 8;

async function readFavorites(userDb: SQLiteDatabase): Promise<string[]> {
  const raw = await getSetting(userDb, SETTING_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Favorite/home airport idents, saved in the user database so they survive
 * content updates and app reinstalls-from-backup the same way bookmarks do.
 * Shared by Weather and TFRs so an ident starred in one shows up in both.
 */
export function useFavoriteAirports(userDb: SQLiteDatabase) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    readFavorites(userDb).then(setFavorites);
  }, [userDb]);

  const toggleFavorite = useCallback(
    async (ident: string) => {
      const id = ident.trim().toUpperCase();
      if (!id) return;
      setFavorites((current) => {
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id].slice(-MAX_FAVORITES);
        setSetting(userDb, SETTING_KEY, JSON.stringify(next));
        return next;
      });
    },
    [userDb]
  );

  const isFavorite = useCallback((ident: string) => favorites.includes(ident.trim().toUpperCase()), [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}

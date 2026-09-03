import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { getSetting, setSetting } from "../db/userdb";
import { useUserDb } from "./UserDbContext";
import { darkColors, FONT_SCALES, lightColors, spacing, type FontSizeKey, type ThemeColors } from "./theme";

export type Appearance = "system" | "light" | "dark";

interface ThemeValue {
  colors: ThemeColors;
  scheme: "light" | "dark";
  spacing: (n: number) => number;
  fontScale: number;
  appearance: Appearance;
  fontSizeKey: FontSizeKey;
  setAppearance: (a: Appearance) => void;
  setFontSizeKey: (k: FontSizeKey) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function useTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error("useTheme() called outside <ThemeProvider>");
  return v;
}

const APPEARANCE_KEY = "appearance";
const FONT_SIZE_KEY = "fontSize";

/**
 * Reads/writes appearance + text-size preferences in the user database (so
 * they survive content updates, same as bookmarks/notes) and derives the
 * live color scheme from either that preference or the OS setting.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const userDb = useUserDb();
  const [appearance, setAppearanceState] = useState<Appearance>("system");
  const [fontSizeKey, setFontSizeKeyState] = useState<FontSizeKey>("default");

  useEffect(() => {
    (async () => {
      const savedAppearance = await getSetting(userDb, APPEARANCE_KEY);
      const savedFontSize = await getSetting(userDb, FONT_SIZE_KEY);
      if (savedAppearance === "system" || savedAppearance === "light" || savedAppearance === "dark") {
        setAppearanceState(savedAppearance);
      }
      if (savedFontSize && savedFontSize in FONT_SCALES) {
        setFontSizeKeyState(savedFontSize as FontSizeKey);
      }
    })();
  }, [userDb]);

  const setAppearance = useCallback(
    (a: Appearance) => {
      setAppearanceState(a);
      setSetting(userDb, APPEARANCE_KEY, a);
    },
    [userDb]
  );

  const setFontSizeKey = useCallback(
    (k: FontSizeKey) => {
      setFontSizeKeyState(k);
      setSetting(userDb, FONT_SIZE_KEY, k);
    },
    [userDb]
  );

  const scheme: "light" | "dark" =
    appearance === "system" ? (systemScheme === "dark" ? "dark" : "light") : appearance;
  const colors = scheme === "dark" ? darkColors : lightColors;
  const fontScale = FONT_SCALES[fontSizeKey];

  const value = useMemo<ThemeValue>(
    () => ({ colors, scheme, spacing, fontScale, appearance, fontSizeKey, setAppearance, setFontSizeKey }),
    [colors, scheme, fontScale, appearance, fontSizeKey, setAppearance, setFontSizeKey]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

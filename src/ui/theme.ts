// Kept deliberately high-contrast and large-type-friendly — this is a
// reference read in cockpits, often in bright sunlight or turbulence.
export interface ThemeColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  farBadge: string;
  aimBadge: string;
  acBadge: string;
  danger: string;
}

export const lightColors: ThemeColors = {
  background: "#FFFFFF",
  surface: "#F4F6F8",
  border: "#DADFE3",
  text: "#12181F",
  textMuted: "#5B6672",
  primary: "#0B5FFF",
  farBadge: "#0B5FFF",
  aimBadge: "#B4530A",
  acBadge: "#5E7B0B",
  danger: "#C0392B",
};

export const darkColors: ThemeColors = {
  background: "#0C1116",
  surface: "#181F27",
  border: "#2C3641",
  text: "#EDF1F5",
  textMuted: "#8B96A3",
  primary: "#5B9BFF",
  farBadge: "#5B9BFF",
  aimBadge: "#E2924A",
  acBadge: "#8FB53A",
  danger: "#FF6E5F",
};

// All-red-on-black, for preserving night vision in a dark cockpit — every
// color here (including what would normally be blue/green/orange accents)
// stays within the red family on purpose, just varying in shade/saturation
// for contrast, rather than hue.
export const nightColors: ThemeColors = {
  background: "#000000",
  surface: "#1A0000",
  border: "#4D0000",
  text: "#FF3B30",
  textMuted: "#992B24",
  primary: "#FF3B30",
  farBadge: "#B23A2E",
  aimBadge: "#992B24",
  acBadge: "#802420",
  danger: "#FF6259",
};

export const FONT_SCALES = {
  small: 0.88,
  default: 1,
  large: 1.15,
  xlarge: 1.3,
} as const;

export type FontSizeKey = keyof typeof FONT_SCALES;

export const FONT_SIZE_LABELS: Record<FontSizeKey, string> = {
  small: "Small",
  default: "Default",
  large: "Large",
  xlarge: "Extra Large",
};

export const spacing = (n: number) => n * 8;

// Static fallback — used only by code that runs before <ThemeProvider> is
// available (e.g. UserDbProvider's own brief loading screen). Everything
// else should use useTheme() from ThemeContext.tsx instead.
export const theme = {
  colors: lightColors,
  spacing,
};

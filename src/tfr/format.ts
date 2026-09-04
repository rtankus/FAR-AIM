// FAA's "LEGAL" categories for TFRs, and a fixed color per category (not
// theme-dependent, same reasoning as the METAR flight-category colors).
const LEGAL_COLORS: Record<string, string> = {
  HAZARDS: "#D32F2F",
  SECURITY: "#8B2FD3",
  VIP: "#8B2FD3",
  SPACE: "#0B5FFF",
  AIRSHOW: "#B4530A",
  SPORT: "#5E7B0B",
  "AIR DEFENSE": "#8B2FD3",
};

export function legalColor(legal: string | null | undefined): string {
  if (!legal) return "#8B96A3";
  return LEGAL_COLORS[legal.toUpperCase()] ?? "#8B96A3";
}

/** FAA timestamps come back as "yyyyMMddHHmm" (UTC, no separators). */
export function parseFaaTimestamp(raw: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)));
}

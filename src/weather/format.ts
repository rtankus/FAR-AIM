import type { FlightCategory } from "./types";

// Standard aviation flight-category colors — these are fixed regardless of
// light/dark app theme, same as sectional chart conventions.
const FLIGHT_CATEGORY_COLORS: Record<string, string> = {
  VFR: "#2E9E4C",
  MVFR: "#0B5FFF",
  IFR: "#D32F2F",
  LIFR: "#C23BC2",
};

export function flightCategoryColor(cat: FlightCategory | null | undefined): string {
  if (!cat) return "#8B96A3";
  return FLIGHT_CATEGORY_COLORS[cat] ?? "#8B96A3";
}

/** "3 min ago", "2 hr ago", etc. */
export function timeAgo(fromMs: number, nowMs = Date.now()): string {
  const diffSec = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr} hr ago`;
  return `${Math.round(diffHr / 24)} days ago`;
}

/** obsTime (unix seconds) as a short local time, e.g. "14:51Z"-style HH:MM. */
export function shortTime(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function severityLabel(hazard: string | null | undefined, severity: string | null | undefined): string {
  return [hazard, severity].filter(Boolean).join(" · ") || "Advisory";
}

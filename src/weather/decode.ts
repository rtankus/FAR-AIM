import type { CloudLayer } from "./types";

// Plain-English decoding of the structured fields aviationweather.gov's API
// already returns alongside the raw text — this is what a page like
// aviationweather.gov/data/metar/?decoded=1 shows, just computed locally
// from data already on-device instead of fetched from a second endpoint, so
// it works offline exactly like the raw report does.

const CLOUD_COVER_LABELS: Record<string, string> = {
  SKC: "Sky clear",
  CLR: "Clear below 12,000 ft",
  CAVOK: "Ceiling and visibility OK",
  FEW: "Few clouds",
  SCT: "Scattered clouds",
  BKN: "Broken clouds",
  OVC: "Overcast",
  VV: "Vertical visibility (obscured sky)",
};

export function decodeClouds(clouds: CloudLayer[] | null | undefined): string[] {
  if (!clouds || clouds.length === 0) return ["No cloud layers reported"];
  return clouds.map((c) => {
    const label = CLOUD_COVER_LABELS[c.cover] ?? c.cover;
    if (c.base == null) return label;
    return `${label} at ${c.base.toLocaleString()} ft AGL`;
  });
}

const WX_INTENSITY: Record<string, string> = { "-": "Light", "+": "Heavy" };
const WX_DESCRIPTOR: Record<string, string> = {
  MI: "Shallow",
  PR: "Partial",
  BC: "Patches of",
  DR: "Low drifting",
  BL: "Blowing",
  SH: "Showers of",
  TS: "Thunderstorm with",
  FZ: "Freezing",
};
const WX_PHENOMENON: Record<string, string> = {
  DZ: "drizzle",
  RA: "rain",
  SN: "snow",
  SG: "snow grains",
  IC: "ice crystals",
  PL: "ice pellets",
  GR: "hail",
  GS: "small hail/snow pellets",
  UP: "unknown precipitation",
  BR: "mist",
  FG: "fog",
  FU: "smoke",
  VA: "volcanic ash",
  DU: "widespread dust",
  SA: "sand",
  HZ: "haze",
  PY: "spray",
  PO: "dust/sand whirls",
  SQ: "squall",
  FC: "funnel cloud/tornado",
  SS: "sandstorm",
  DS: "duststorm",
};

/** Splits a raw wxString like "-SHRA BR" into its individual space-separated groups. */
function splitWxGroups(wxString: string): string[] {
  return wxString.trim().split(/\s+/).filter(Boolean);
}

function decodeWxGroup(group: string): string {
  let rest = group;
  let vicinity = false;
  if (rest.startsWith("VC")) {
    vicinity = true;
    rest = rest.slice(2);
  }
  let intensity = "";
  if (rest[0] === "-" || rest[0] === "+") {
    intensity = WX_INTENSITY[rest[0]];
    rest = rest.slice(1);
  }
  const parts: string[] = [];
  // Peel off any two-letter descriptor/phenomenon codes in sequence.
  while (rest.length >= 2) {
    const code = rest.slice(0, 2);
    if (WX_DESCRIPTOR[code]) {
      parts.push(WX_DESCRIPTOR[code].toLowerCase());
      rest = rest.slice(2);
    } else if (WX_PHENOMENON[code]) {
      parts.push(WX_PHENOMENON[code]);
      rest = rest.slice(2);
    } else {
      break;
    }
  }
  const words = [intensity, ...parts].filter(Boolean).join(" ") || group;
  return vicinity ? `${words} in the vicinity` : words;
}

export function decodeWxString(wxString: string | null | undefined): string[] {
  if (!wxString || !wxString.trim()) return [];
  return splitWxGroups(wxString).map(decodeWxGroup);
}

export function decodeWind(
  wdir: number | string | null | undefined,
  wspd: number | null | undefined,
  wgst: number | null | undefined
): string {
  if (wspd == null || wspd === 0) return "Calm";
  const dir = wdir === "VRB" || wdir == null ? "variable direction" : `${wdir}°`;
  const gust = wgst ? `, gusting ${wgst} kt` : "";
  return `From ${dir} at ${wspd} kt${gust}`;
}

export function decodeVisibility(visib: number | string | null | undefined): string {
  if (visib == null) return "Not reported";
  if (typeof visib === "string") return `${visib} statute miles`;
  return `${visib} statute mile${visib === 1 ? "" : "s"}`;
}

/** aviationweather.gov reports altimeter in hPa; most US pilots read inHg. */
export function decodeAltimeter(altimHpa: number | null | undefined): string {
  if (altimHpa == null) return "Not reported";
  const inHg = altimHpa * 0.02953;
  return `${inHg.toFixed(2)} inHg (${Math.round(altimHpa)} hPa)`;
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

export function decodeTemp(tempC: number | null | undefined, dewpC: number | null | undefined): string {
  const temp = tempC != null ? `${Math.round(tempC)}°C (${cToF(tempC)}°F)` : "Not reported";
  const dewp = dewpC != null ? `${Math.round(dewpC)}°C (${cToF(dewpC)}°F)` : "Not reported";
  return `Temp ${temp} · Dewpoint ${dewp}`;
}

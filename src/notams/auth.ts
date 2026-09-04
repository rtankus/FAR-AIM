import type { NotamCredentials } from "./credentials";

// The FAA/CGI NMS-API (NOTAM Management Service). These credentials were
// issued against the pre-prod/staging test environment, not production —
// there's a separate `api-nms.aim.faa.gov` production host that needs its
// own onboarding once real production access is granted.
export const NMS_AUTH_HOST = "https://api-staging.cgifederal-aim.com";
export const NMS_API_BASE = "https://api-staging.cgifederal-aim.com/nmsapi";

// Plain-ASCII base64 encoder for the Basic auth header — avoids depending on
// `btoa` being globally available in the Hermes runtime.
function base64Encode(input: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  let i = 0;
  while (i < input.length) {
    const a = input.charCodeAt(i++);
    const b = i < input.length ? input.charCodeAt(i++) : NaN;
    const c = i < input.length ? input.charCodeAt(i++) : NaN;
    const bitmap = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
    output +=
      chars.charAt((bitmap >> 18) & 63) +
      chars.charAt((bitmap >> 12) & 63) +
      (Number.isNaN(b) ? "=" : chars.charAt((bitmap >> 6) & 63)) +
      (Number.isNaN(c) ? "=" : chars.charAt(bitmap & 63));
  }
  return output;
}

interface CachedToken {
  token: string;
  expiresAt: number;
  clientId: string;
}

// Kept in memory only (not persisted) — a 30-minute bearer token isn't worth
// writing to disk, and re-authenticating on cold app start is cheap and
// simple.
let cached: CachedToken | null = null;

/** A valid bearer token for `creds`, reusing the cached one if it isn't close to expiring. */
export async function getAccessToken(creds: NotamCredentials): Promise<string> {
  if (cached && cached.clientId === creds.clientId && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const res = await fetch(`${NMS_AUTH_HOST}/v1/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${base64Encode(`${creds.clientId}:${creds.clientSecret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("FAA NOTAM API rejected the credentials — check them in Settings.");
    throw new Error(`FAA NOTAM auth returned ${res.status}`);
  }
  const data = await res.json();
  if (!data.access_token) throw new Error("FAA NOTAM auth response had no access token.");

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 1799) * 1000,
    clientId: creds.clientId,
  };
  return cached.token;
}

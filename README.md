# FAR/AIM Offline

An offline-first iOS app for reading the FARs (14 CFR) and the Aeronautical
Information Manual, with an in-app "check for updates" that pulls fresh
content from the official sources when you have a signal.

## How it's put together

- **App**: Expo (React Native + TypeScript), React Navigation, `expo-sqlite`
  with an FTS5 full-text index for search.
- **Content**: a single bundled SQLite file (`assets/content/faraim.db`)
  ships inside the app install, so it works with zero network from first
  launch. On demand, the app checks a small JSON manifest online and, if a
  newer bundle exists, downloads and swaps it in.
- **Content pipeline** (`content-pipeline/`): a separate Node project (not
  shipped in the app) that builds `faraim.db` from two sources:
  - **FARs** — the [eCFR API](https://www.ecfr.gov/developers/documentation/api/v1),
    official, free, no key required.
  - **AIM** — scraped from the FAA's own HTML AIM
    (`faa.gov/air_traffic/publications/atpubs/aim_html/`). It's a U.S.
    government work, public domain, so parsing/redistributing it is fine.

## Project layout

```
App.tsx                  # entry: SQLiteProvider + NavigationContainer
src/
  ui/                     # screens, navigation, components, theme
  db/                     # database.ts (open/update), queries.ts
  content/types.ts        # Section/Manifest types shared by app + pipeline
  config.ts               # CONTENT_MANIFEST_URL — point this at your hosting
assets/content/           # bundled faraim.db + manifest.json (built artifacts)
content-pipeline/         # Node scripts that build assets/content/*
```

## Running the app

```bash
npm install
npm run ios      # requires Xcode + a simulator or a device on the same Mac
```

## Rebuilding the FAR/AIM content

```bash
cd content-pipeline
npm install
npm run build     # fetch:far + fetch:aim + build:db
```

This re-fetches both sources, rebuilds `content-pipeline/output/faraim.db`
and `manifest.json`, and copies both into `assets/content/` so the next app
build ships the refreshed content. Edit `PARTS` in
`content-pipeline/scripts/fetch-far.mjs` to add/remove 14 CFR parts (it
currently covers Parts 1, 43, 61, 67, 68, 71, 91, 93, 97 — the general-aviation
core).

**Known gaps to fill in later:** the Pilot/Controller Glossary is a separate
FAA publication not linked from the AIM HTML index, so it isn't scraped yet;
AIM appendices are scanned paper forms (images), not text, so they're
skipped.

## Shipping content updates without a full app rebuild

This is already wired up end-to-end via GitHub Releases, pointed at
[rtankus/FAR-AIM](https://github.com/rtankus/FAR-AIM) (`GITHUB_REPO` in
`src/config.ts`, `manifest.downloadUrl` in
`content-pipeline/scripts/build-db.mjs` — keep the two in sync if the repo
ever moves, and rerun `npm run build:db` afterward to bake the corrected URL
into `assets/content/manifest.json`).

Push this repo to GitHub (public — see below for why) and:

1. **`.github/workflows/update-content.yml`** runs every Monday (and on
   manual dispatch from the Actions tab). It re-fetches eCFR + the AIM,
   rebuilds `faraim.db`, commits the refreshed bundle back to `main` (so the
   *next app build* also ships current content), and publishes it to a
   rolling `content-latest` GitHub Release — giving stable, public,
   no-auth-required URLs:
   ```
   https://github.com/<owner>/<repo>/releases/download/content-latest/manifest.json
   https://github.com/<owner>/<repo>/releases/download/content-latest/faraim.db
   ```
2. In the app, Home → "Check for Updates" fetches that manifest, and if the
   version differs from what's installed, downloads and swaps the new
   database in place — no App Store/TestFlight update required for content
   changes, only for app code changes.

No extra hosting account needed (no S3/R2) — it all lives on the same GitHub
repo the code does.

**The repo needs to be public.** The app fetches the release assets
unauthenticated; a private repo would require embedding a token in the app
binary to download them, which isn't safe (it can be extracted from the
`.ipa`). There's nothing sensitive to protect here anyway — the FAR/AIM
content is U.S. government public-domain text, and the app code has no
secrets in it.

## Distribution: sideloading on iOS

No Apple Developer Program membership ($99/yr) and no App Store review —
you're installing straight onto your own device(s).

**Build it:**
```bash
npx eas build --profile adhoc --platform ios
```
(First run walks you through `eas login` and creates a free Expo account —
EAS's free tier covers occasional builds like this.)

**Install it**, two options:

- **Xcode, manually**: plug the device in, drag the `.ipa` into Xcode's
  Devices window, or use `xcrun devicectl device install app`. Free Apple ID
  signing **expires after 7 days** — the app stops opening until you
  reconnect and reinstall.
- **SideStore** (recommended for actual use): after a one-time setup
  (pairing your device over USB once), SideStore refreshes the app's
  signature automatically over Wi-Fi roughly weekly, without needing a Mac
  nearby each time the way AltStore does. See
  [sidestore.io](https://sidestore.io) for setup — it's the practical way to
  keep a free-signed app usable day to day.

A free Apple ID can have at most **3 sideloaded apps** installed at once and
each provisioning profile is good for 7 days regardless of install method —
these are Apple platform limits, not something SideStore/AltStore can lift.

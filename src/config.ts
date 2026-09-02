// Where the app checks for a newer FAR/AIM content bundle. The weekly
// .github/workflows/update-content.yml job publishes here — a rolling
// "content-latest" GitHub Release on this repo. Replace the owner/repo below
// once you know your actual GitHub repo slug (see README.md).
const GITHUB_REPO = "rtankus/FAR-AIM";
export const CONTENT_MANIFEST_URL = `https://github.com/${GITHUB_REPO}/releases/download/content-latest/manifest.json`;

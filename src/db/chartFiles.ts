import { Directory, File, Paths } from "expo-file-system";

// Saved FAA chart PDFs live in Documents/charts/ — mirrors tcdsFiles.ts's
// reasoning exactly: kept out of Paths.cache (which the OS can purge under
// storage pressure) since these are meant to stay put until removed.
const CHARTS_DIR_NAME = "charts";

function chartsDirectory(): Directory {
  const dir = new Directory(Paths.document, CHARTS_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * A fresh (not-yet-written) destination for a chart PDF, plus the
 * Documents-relative path to persist alongside it. Store the relative path,
 * not `file.uri` — see tcdsFiles.ts's newTcdsDestination() for why an
 * absolute file:// URI would go stale across reinstalls.
 */
export function newChartDestination(): { file: File; relativePath: string } {
  const filename = `${Date.now()}.pdf`;
  return { file: new File(chartsDirectory(), filename), relativePath: `${CHARTS_DIR_NAME}/${filename}` };
}

/** Resolves a SavedChart's stored (Documents-relative) path to a live File, against the current container. */
export function resolveChartFile(relativePath: string): File {
  return new File(Paths.document, relativePath);
}

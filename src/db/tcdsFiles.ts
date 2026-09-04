import { Directory, File, Paths } from "expo-file-system";

// Saved TCDS PDFs live in Documents/tcds/. Deliberately kept out of the
// Documents-root chaos and out of Paths.cache, which the OS is free to purge
// under storage pressure — these are meant to stay put until the user
// deletes them.
const TCDS_DIR_NAME = "tcds";

function tcdsDirectory(): Directory {
  const dir = new Directory(Paths.document, TCDS_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * A fresh (not-yet-written) destination for a new TCDS PDF, plus the
 * Documents-relative path to persist alongside it. Store the relative path,
 * not `file.uri` — the absolute sandbox container path changes across app
 * reinstalls, so anything saved as an absolute file:// URI goes stale
 * ("no such file") the next time the app is rebuilt or reinstalled.
 */
export function newTcdsDestination(): { file: File; relativePath: string } {
  const filename = `${Date.now()}.pdf`;
  return { file: new File(tcdsDirectory(), filename), relativePath: `${TCDS_DIR_NAME}/${filename}` };
}

/** Resolves a TcdsDocument's stored (Documents-relative) path to a live File, against the current container. */
export function resolveTcdsFile(relativePath: string): File {
  return new File(Paths.document, relativePath);
}

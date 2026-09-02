import { createContext, useContext } from "react";

/**
 * Lets any screen force <SQLiteProvider> to unmount/remount (and thus reopen
 * the database file from disk) after a content update has been applied.
 */
export const ReloadContext = createContext<{ reloadDatabase: () => void }>({
  reloadDatabase: () => {},
});

export function useReloadDatabase() {
  return useContext(ReloadContext).reloadDatabase;
}

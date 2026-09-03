import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as SQLite from "expo-sqlite";
import { useSQLiteContext } from "expo-sqlite";
import { initUserDb, migrateLegacyUserData, USER_DB_NAME } from "../db/userdb";
import { theme } from "./theme";

const UserDbContext = createContext<SQLite.SQLiteDatabase | null>(null);

/** The user-data database (bookmarks, recently-viewed, highlights/notes). */
export function useUserDb(): SQLite.SQLiteDatabase {
  const db = useContext(UserDbContext);
  if (!db) throw new Error("useUserDb() called outside <UserDbProvider>");
  return db;
}

/**
 * Opens (and migrates) the user-data database once, then renders children.
 * Must be mounted below the content <SQLiteProvider> — it reads the content
 * db once, to migrate any pre-existing bookmarks/recently-viewed rows that
 * used to live there.
 */
export function UserDbProvider({ children }: { children: ReactNode }) {
  const contentDb = useSQLiteContext();
  const [userDb, setUserDb] = useState<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await SQLite.openDatabaseAsync(USER_DB_NAME);
      await initUserDb(db);
      await migrateLegacyUserData(db, contentDb);
      if (!cancelled) setUserDb(db);
    })();
    return () => {
      cancelled = true;
    };
    // contentDb only changes when the content db is reopened (dbKey bump),
    // which never needs to re-migrate or reopen the user db.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!userDb) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading FAR/AIM…</Text>
      </View>
    );
  }

  return <UserDbContext.Provider value={userDb}>{children}</UserDbContext.Provider>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  loadingText: { marginTop: 12, color: theme.colors.textMuted },
});

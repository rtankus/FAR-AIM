import { Suspense, useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/ui/navigation/RootNavigator";
import InstallExpiryBar from "./src/ui/components/InstallExpiryBar";
import { ReloadContext } from "./src/ui/ReloadContext";
import { UserDbProvider } from "./src/ui/UserDbContext";
import { AirportsDbProvider } from "./src/ui/AirportsDbContext";
import { useAutoUpdateAirportsData } from "./src/ui/hooks/useAutoUpdateAirportsData";
import { ThemeProvider, useTheme } from "./src/ui/ThemeContext";
import { DB_NAME, bundledDbAsset } from "./src/db/database";
import { theme } from "./src/ui/theme";

export default function App() {
  // Bumping this remounts <SQLiteProvider>, which reopens faraim.db from
  // disk — used after a content update has been downloaded and swapped in.
  const [dbKey, setDbKey] = useState(0);
  const reloadDatabase = useCallback(() => setDbKey((k) => k + 1), []);

  return (
    <SafeAreaProvider>
      <ReloadContext.Provider value={{ reloadDatabase }}>
        <Suspense fallback={<LoadingFallback />}>
          <SQLiteProvider
            key={dbKey}
            databaseName={DB_NAME}
            assetSource={{ assetId: bundledDbAsset }}
            useSuspense
          >
            <UserDbProvider>
              <AirportsDbProvider>
                <ThemeProvider>
                  <AppShell />
                </ThemeProvider>
              </AirportsDbProvider>
            </UserDbProvider>
          </SQLiteProvider>
        </Suspense>
      </ReloadContext.Provider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  useAutoUpdateAirportsData();
  const { scheme, colors } = useTheme();
  const navTheme = scheme === "dark" ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      theme={{
        ...navTheme,
        colors: { ...navTheme.colors, background: colors.background, card: colors.background, text: colors.text, border: colors.border, primary: colors.primary },
      }}
    >
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <InstallExpiryBar />
      <RootNavigator />
    </NavigationContainer>
  );
}

function LoadingFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.loadingText}>Loading FAR/AIM…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  loadingText: { marginTop: 12, color: theme.colors.textMuted },
});

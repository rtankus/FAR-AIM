import { Suspense, useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/ui/navigation/RootNavigator";
import { ReloadContext } from "./src/ui/ReloadContext";
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
            <NavigationContainer>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </SQLiteProvider>
        </Suspense>
      </ReloadContext.Provider>
    </SafeAreaProvider>
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

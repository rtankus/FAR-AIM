import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as Network from "expo-network";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { theme } from "../theme";
import { useReloadDatabase } from "../ReloadContext";
import {
  checkForContentUpdate,
  downloadAndApplyContentUpdate,
  getInstalledVersion,
  type UpdateCheckResult,
} from "../../db/database";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const reloadDatabase = useReloadDatabase();
  const [version, setVersion] = useState<{ version: string; builtAt: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getInstalledVersion(db).then(setVersion);
  }, [db]);

  const applyUpdate = useCallback(
    async (res: UpdateCheckResult) => {
      setUpdating(true);
      try {
        await db.closeAsync();
        await downloadAndApplyContentUpdate(res.remoteManifest);
        reloadDatabase();
      } catch (err) {
        Alert.alert("Update failed", String(err));
      } finally {
        setUpdating(false);
      }
    },
    [db, reloadDatabase]
  );

  const handleCheckForUpdates = useCallback(async () => {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || !net.isInternetReachable) {
      Alert.alert("Offline", "Connect to the internet to check for FAR/AIM updates.");
      return;
    }
    setChecking(true);
    try {
      const result = await checkForContentUpdate(db);
      if (!result.updateAvailable) {
        Alert.alert("Up to date", "You already have the latest FAR/AIM content.");
        return;
      }
      Alert.alert(
        "Update available",
        `A newer FAR/AIM content bundle (${result.remoteManifest.version}) is available. Download it now?`,
        [
          { text: "Not now", style: "cancel" },
          { text: "Download", onPress: () => applyUpdate(result) },
        ]
      );
    } catch (err) {
      Alert.alert("Couldn't check for updates", String(err));
    } finally {
      setChecking(false);
    }
  }, [db, applyUpdate]);

  return (
    <View style={styles.container}>
      <Text style={styles.appTitle}>FAR/AIM Offline</Text>
      <Text style={styles.appSubtitle}>
        14 CFR + Aeronautical Information Manual, available without a signal.
      </Text>

      <View style={styles.grid}>
        <NavCard label="Browse FARs" hint="14 CFR by Part" onPress={() => navigation.navigate("PartsList", { source: "FAR" })} />
        <NavCard label="Browse AIM" hint="By Chapter" onPress={() => navigation.navigate("PartsList", { source: "AIM" })} />
        <NavCard label="Search" hint="Full text" onPress={() => navigation.navigate("Search")} />
        <NavCard label="Bookmarks" hint="Saved sections" onPress={() => navigation.navigate("Bookmarks")} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>
          {version ? `Content built ${new Date(version.builtAt).toLocaleDateString()}` : "Loading content info…"}
        </Text>
        <Pressable
          onPress={handleCheckForUpdates}
          disabled={checking || updating}
          style={({ pressed }) => [styles.updateButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.updateButtonText}>
            {updating ? "Updating…" : checking ? "Checking…" : "Check for Updates"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function NavCard({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cardStyles.card, pressed && { opacity: 0.8 }]}>
      <Text style={cardStyles.label}>{label}</Text>
      <Text style={cardStyles.hint}>{hint}</Text>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  label: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(2.5) },
  appTitle: { fontSize: 26, fontWeight: "800", color: theme.colors.text, marginTop: theme.spacing(2) },
  appSubtitle: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4, marginBottom: theme.spacing(3) },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  footer: { marginTop: "auto", paddingTop: theme.spacing(2), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  versionText: { fontSize: 12, color: theme.colors.textMuted, marginBottom: theme.spacing(1) },
  updateButton: { backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: theme.spacing(1.5), alignItems: "center" },
  updateButtonText: { color: "#fff", fontWeight: "700" },
});

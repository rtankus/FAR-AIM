import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as Network from "expo-network";
import { useTheme, type Appearance } from "../ThemeContext";
import { FONT_SIZE_LABELS, FONT_SCALES, type FontSizeKey, type ThemeColors } from "../theme";
import { useReloadDatabase } from "../ReloadContext";
import { useAirportsDb, useReloadAirportsDb } from "../AirportsDbContext";
import { useUserDb } from "../UserDbContext";
import { getNotamCredentials, setNotamCredentials } from "../../notams/credentials";
import {
  applyDownloadedContentUpdate,
  checkForContentUpdate,
  downloadContentUpdate,
  getInstalledVersion,
  type UpdateCheckResult,
} from "../../db/database";
import {
  applyDownloadedAirportsUpdate,
  checkForAirportsUpdate,
  downloadAirportsUpdate,
  getInstalledAirportsVersion,
  type AirportsUpdateCheckResult,
} from "../../db/airportsDatabase";

const APPEARANCE_OPTIONS: { key: Appearance; label: string }[] = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "night", label: "Night" },
];

const FONT_SIZE_OPTIONS = Object.keys(FONT_SCALES) as FontSizeKey[];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const userDb = useUserDb();
  const reloadDatabase = useReloadDatabase();
  const airportsDb = useAirportsDb();
  const { close: closeAirportsDb, reopen: reopenAirportsDb } = useReloadAirportsDb();
  const { colors, spacing, appearance, setAppearance, fontSizeKey, setFontSizeKey } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing), [colors, spacing]);
  const [version, setVersion] = useState<{ version: string; builtAt: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [airportsVersion, setAirportsVersion] = useState<{ version: string; builtAt: string } | null>(null);
  const [checkingAirports, setCheckingAirports] = useState(false);
  const [updatingAirports, setUpdatingAirports] = useState(false);
  const [notamClientId, setNotamClientId] = useState("");
  const [notamClientSecret, setNotamClientSecret] = useState("");
  const [notamSavedOnce, setNotamSavedOnce] = useState(false);

  useEffect(() => {
    getInstalledVersion(db).then(setVersion);
  }, [db]);

  useEffect(() => {
    getNotamCredentials(userDb).then((creds) => {
      if (creds) {
        setNotamClientId(creds.clientId);
        setNotamClientSecret(creds.clientSecret);
        setNotamSavedOnce(true);
      }
    });
  }, [userDb]);

  const saveNotamCredentials = useCallback(() => {
    if (!notamClientId.trim() || !notamClientSecret.trim()) {
      Alert.alert("Missing info", "Enter both the Key and Secret from your NMS-API onboarding spreadsheet.");
      return;
    }
    setNotamCredentials(userDb, { clientId: notamClientId, clientSecret: notamClientSecret }).then(() => {
      setNotamSavedOnce(true);
      Alert.alert("Saved", "NOTAMs will now show up when you search an airport or check nearby weather.");
    });
  }, [notamClientId, notamClientSecret, userDb]);

  useEffect(() => {
    if (airportsDb) getInstalledAirportsVersion(airportsDb).then(setAirportsVersion);
  }, [airportsDb]);

  const applyUpdate = useCallback(
    async (res: UpdateCheckResult) => {
      setUpdating(true);
      try {
        // Download first, while the shared db connection is still open — a
        // network failure here leaves the app fully usable.
        const tempFile = await downloadContentUpdate(res.remoteManifest);
        await db.closeAsync();
        try {
          await applyDownloadedContentUpdate(tempFile);
        } finally {
          // Always reopen, even if the file swap above failed — otherwise
          // every screen sharing this closed connection breaks until the
          // app is force-quit.
          reloadDatabase();
        }
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
      const message = String(err instanceof Error ? err.message : err);
      if (/closed/i.test(message)) {
        // The shared db connection was left closed by an earlier update
        // attempt that didn't fully recover — reopening it here means the
        // user doesn't have to force-quit the app to get back to a working
        // state, just retry.
        reloadDatabase();
        Alert.alert(
          "Reconnected",
          "The FAR/AIM database connection had dropped — it's been reopened. Try Check for Updates again."
        );
      } else {
        Alert.alert("Couldn't check for updates", message);
      }
    } finally {
      setChecking(false);
    }
  }, [db, applyUpdate, reloadDatabase]);

  const applyAirportsUpdate = useCallback(
    async (res: AirportsUpdateCheckResult) => {
      setUpdatingAirports(true);
      try {
        // Download first, while the shared db connection is still open — a
        // network failure here leaves the app fully usable.
        const tempFile = await downloadAirportsUpdate(res.remoteManifest);
        await closeAirportsDb();
        try {
          await applyDownloadedAirportsUpdate(tempFile);
        } finally {
          // Always reopen, even if the file swap above failed — otherwise
          // every screen using airports.db breaks until the app is force-quit.
          await reopenAirportsDb();
        }
      } catch (err) {
        Alert.alert("Update failed", String(err));
      } finally {
        setUpdatingAirports(false);
      }
    },
    [closeAirportsDb, reopenAirportsDb]
  );

  const handleCheckForAirportsUpdates = useCallback(async () => {
    if (!airportsDb) return;
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || !net.isInternetReachable) {
      Alert.alert("Offline", "Connect to the internet to check for airport data updates.");
      return;
    }
    setCheckingAirports(true);
    try {
      const result = await checkForAirportsUpdate(airportsDb);
      if (!result.updateAvailable) {
        Alert.alert("Up to date", "You already have the latest airport data.");
        return;
      }
      Alert.alert(
        "Update available",
        `A newer airports data bundle (${result.remoteManifest.version}) is available. Download it now?`,
        [
          { text: "Not now", style: "cancel" },
          { text: "Download", onPress: () => applyAirportsUpdate(result) },
        ]
      );
    } catch (err) {
      Alert.alert("Couldn't check for updates", String(err instanceof Error ? err.message : err));
    } finally {
      setCheckingAirports(false);
    }
  }, [airportsDb, applyAirportsUpdate]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.segmentRow}>
        {APPEARANCE_OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => setAppearance(opt.key)}
            style={[styles.segment, appearance === opt.key && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, appearance === opt.key && styles.segmentTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {appearance === "night" ? (
        <Text style={styles.helperText}>
          All-red display to help preserve your night vision in a dark cockpit.
        </Text>
      ) : null}

      <Text style={styles.sectionLabel}>Text Size</Text>
      <View style={styles.segmentRow}>
        {FONT_SIZE_OPTIONS.map((key) => (
          <Pressable
            key={key}
            onPress={() => setFontSizeKey(key)}
            style={[styles.segment, fontSizeKey === key && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, fontSizeKey === key && styles.segmentTextActive]}>
              {FONT_SIZE_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>Preview</Text>
        <Text style={[styles.previewBody, { fontSize: 17 * FONT_SCALES[fontSizeKey] }]}>
          No person may operate an aircraft in a careless or reckless manner so as to endanger the life or property of another.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Content</Text>
      <View style={styles.contentCard}>
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

      <Text style={styles.sectionLabel}>Airports Data</Text>
      <View style={styles.contentCard}>
        <Text style={styles.versionText}>
          {airportsVersion
            ? `Airport/procedure data built ${new Date(airportsVersion.builtAt).toLocaleDateString()}`
            : "Loading airport data info…"}
        </Text>
        <Text style={styles.helperText}>
          Runways, frequencies, full SID/STAR/approach procedure text (fixes, IAF/IF/FAF/MAP, altitudes), and links
          to the FAA's official chart PDFs for US airports (FAA CIFP + d-TPP + OurAirports).
        </Text>
        <Pressable
          onPress={handleCheckForAirportsUpdates}
          disabled={!airportsDb || checkingAirports || updatingAirports}
          style={({ pressed }) => [styles.updateButton, { marginTop: spacing(1) }, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.updateButtonText}>
            {updatingAirports ? "Updating…" : checkingAirports ? "Checking…" : "Check for Updates"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>FAA NOTAM API (NMS)</Text>
      <View style={styles.contentCard}>
        <Text style={styles.helperText}>
          Enter the Key and Secret from your NMS-API onboarding spreadsheet. These credentials are currently
          issued for the FAA's pre-production/staging test environment, not production — treat any NOTAM shown
          in this app as a test feed, not one to fly on.
        </Text>
        <TextInput
          value={notamClientId}
          onChangeText={setNotamClientId}
          placeholder="Key (Client ID)"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.credInput, { marginTop: spacing(1.5) }]}
        />
        <TextInput
          value={notamClientSecret}
          onChangeText={setNotamClientSecret}
          placeholder="Secret (Client Secret)"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[styles.credInput, { marginTop: spacing(1) }]}
        />
        <Pressable
          onPress={saveNotamCredentials}
          style={({ pressed }) => [styles.updateButton, { marginTop: spacing(1.5) }, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.updateButtonText}>{notamSavedOnce ? "Update" : "Save"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(4) },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      marginTop: spacing(2),
      marginBottom: spacing(1),
    },
    segmentRow: {
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 4,
      gap: 4,
    },
    segment: { flex: 1, paddingVertical: spacing(1.25), borderRadius: 8, alignItems: "center" },
    segmentActive: { backgroundColor: colors.primary },
    segmentText: { color: colors.text, fontWeight: "600", fontSize: 14 },
    segmentTextActive: { color: "#fff" },
    previewCard: {
      marginTop: spacing(4),
      padding: spacing(2),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    previewLabel: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(1) },
    previewBody: { color: colors.text, lineHeight: 26 },
    helperText: { fontSize: 12, color: colors.textMuted, marginTop: spacing(1), lineHeight: 16 },
    contentCard: {
      padding: spacing(2),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    versionText: { fontSize: 12, color: colors.textMuted, marginBottom: spacing(1) },
    credInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.1),
      color: colors.text,
      fontSize: 15,
    },
    updateButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: spacing(1.5), alignItems: "center" },
    updateButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  });
}

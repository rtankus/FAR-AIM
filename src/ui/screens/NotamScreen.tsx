import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { useLocation } from "../hooks/useLocation";
import { useFavoriteAirports } from "../hooks/useFavoriteAirports";
import { fetchNotamsByLocation, fetchNotamsByRadius, NotamCredentialsMissingError } from "../../notams/api";
import { staleWhileRevalidateNotams } from "../../notams/cache";
import { distanceNm } from "../../weather/distance";
import { timeAgo } from "../../weather/format";
import { NotamCard, StalenessBanner } from "../components/WeatherReportCards";
import type { Notam } from "../../notams/types";

type Props = NativeStackScreenProps<RootStackParamList, "Notams">;

const RADII_NM = [25, 50, 100] as const;

interface Row {
  notam: Notam;
  dist: number | null;
}

function bucket(n: number): number {
  return Math.round(n * 2) / 2;
}

export default function NotamScreen({ navigation }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const { locate } = useLocation();
  const { favorites } = useFavoriteAirports(userDb);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<TabParamList>>();

  const [rows, setRows] = useState<Row[]>([]);
  const [centerLabel, setCenterLabel] = useState<string | null>(null);
  const [radius, setRadius] = useState<(typeof RADII_NM)[number]>(50);
  const [searchIdent, setSearchIdent] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [meta, setMeta] = useState<{ fetchedAt: number; stale: boolean; offline: boolean } | null>(null);

  const applyResult = useCallback((data: Notam[], here: { lat: number; lon: number } | null) => {
    setRows(
      data
        .map((notam): Row => ({
          notam,
          dist: here && notam.lat != null && notam.lon != null ? distanceNm(here.lat, here.lon, notam.lat, notam.lon) : null,
        }))
        .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))
    );
  }, []);

  const searchByLocation = useCallback(
    async (overrideIdent?: string) => {
      const id = (overrideIdent ?? searchIdent).trim().toUpperCase();
      if (!id) return;
      Keyboard.dismiss();
      setLoading(true);
      setError(null);
      setSetupNeeded(false);
      setCenterLabel(id);
      try {
        const res = await staleWhileRevalidateNotams(userDb, `notam:${id}`, () => fetchNotamsByLocation(userDb, id), (fresh) => {
          applyResult(fresh.data, null);
          setMeta({ fetchedAt: fresh.fetchedAt, stale: fresh.stale, offline: fresh.offline });
        });
        applyResult(res.data, null);
        setMeta({ fetchedAt: res.fetchedAt, stale: res.stale, offline: res.offline });
      } catch (err) {
        if (err instanceof NotamCredentialsMissingError) setSetupNeeded(true);
        else setError(String(err instanceof Error ? err.message : err));
      } finally {
        setLoading(false);
      }
    },
    [searchIdent, userDb, applyResult]
  );

  const searchNearby = useCallback(
    async (radiusNm: (typeof RADII_NM)[number]) => {
      setLocating(true);
      setLoading(true);
      setError(null);
      setSetupNeeded(false);
      try {
        const here = await locate();
        if (!here) {
          setError("Location permission is needed to find nearby NOTAMs.");
          return;
        }
        setCenterLabel("your location");
        const key = `notam-nearby:${bucket(here.lat)},${bucket(here.lon)},${radiusNm}`;
        const res = await staleWhileRevalidateNotams(
          userDb,
          key,
          () => fetchNotamsByRadius(userDb, here.lat, here.lon, radiusNm),
          (fresh) => {
            applyResult(fresh.data, here);
            setMeta({ fetchedAt: fresh.fetchedAt, stale: fresh.stale, offline: fresh.offline });
          }
        );
        applyResult(res.data, here);
        setMeta({ fetchedAt: res.fetchedAt, stale: res.stale, offline: res.offline });
      } catch (err) {
        if (err instanceof NotamCredentialsMissingError) setSetupNeeded(true);
        else setError(String(err instanceof Error ? err.message : err));
      } finally {
        setLocating(false);
        setLoading(false);
      }
    },
    [locate, userDb, applyResult]
  );

  // Try to center on the device's location automatically as soon as the
  // screen opens, same as Nearby Weather/TFRs — falls back to just showing
  // the search bar if permission is denied.
  useEffect(() => {
    searchNearby(radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRadiusChange = useCallback(
    (r: (typeof RADII_NM)[number]) => {
      setRadius(r);
      searchNearby(r);
    },
    [searchNearby]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {favorites.length > 0 ? (
          <View style={styles.favRow}>
            {favorites.map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  setSearchIdent(f);
                  searchByLocation(f);
                }}
                style={styles.favChip}
              >
                <Text style={styles.favChipText}>★ {f}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.searchRow}>
          <TextInput
            value={searchIdent}
            onChangeText={setSearchIdent}
            onSubmitEditing={() => searchByLocation()}
            placeholder="Search an airport (e.g. KATL)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          <Pressable
            onPress={() => searchByLocation()}
            disabled={loading || !searchIdent.trim()}
            style={({ pressed }) => [styles.goButton, (pressed || loading) && { opacity: 0.7 }]}
          >
            <Text style={styles.goButtonText}>{loading ? "…" : "Go"}</Text>
          </Pressable>
        </View>

        <View style={styles.centerRow}>
          <Text style={styles.centerLabel} numberOfLines={1}>
            {centerLabel ? `Near ${centerLabel}` : "Search or use your location"}
          </Text>
          <Pressable onPress={() => searchNearby(radius)} disabled={locating}>
            <Text style={styles.myLocationLink}>{locating ? "Locating…" : "Use my location"}</Text>
          </Pressable>
        </View>

        <View style={styles.radiusRow}>
          {RADII_NM.map((r) => (
            <Pressable
              key={r}
              onPress={() => handleRadiusChange(r)}
              style={[styles.radiusChip, r === radius && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.radiusChipText, r === radius && { color: "#fff" }]}>{r} nm</Text>
            </Pressable>
          ))}
        </View>

        {meta ? <StalenessBanner stale={meta.stale} offline={meta.offline} fetchedAtLabel={timeAgo(meta.fetchedAt)} /> : null}
      </View>

      {setupNeeded ? (
        <Pressable onPress={() => tabNavigation?.navigate("SettingsTab", { screen: "Settings" })} style={styles.setupCard}>
          <Text style={styles.setupCardText}>Add your FAA NOTAM API credentials in Settings to use this.</Text>
          <Text style={styles.setupCardLink}>Open Settings ›</Text>
        </Pressable>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {loading && rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) => r.notam.id ?? String(i)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            !loading && !error && !setupNeeded ? <Text style={styles.empty}>No active NOTAMs found.</Text> : null
          }
          renderItem={({ item }) => <NotamCard notam={item.notam} distanceNm={item.dist ?? undefined} />}
        />
      )}

      <Text style={styles.footnote}>
        NOTAMs are from the FAA's NMS-API test environment — this is a pre-production/staging feed for
        development purposes, not a certified source for flight planning.
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing(2.5), paddingTop: spacing(2) },
    favRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: spacing(1) },
    favChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.6),
      marginRight: spacing(1),
      marginBottom: spacing(0.75),
    },
    favChipText: { color: colors.text, fontWeight: "600", fontSize: 12.5 * fontScale },
    searchRow: { flexDirection: "row", marginBottom: spacing(1) },
    input: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      color: colors.text,
      fontSize: 14 * fontScale,
      marginRight: spacing(1),
    },
    goButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: spacing(2.25),
      alignItems: "center",
      justifyContent: "center",
    },
    goButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 * fontScale },
    centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing(1) },
    centerLabel: { flex: 1, fontSize: 12 * fontScale, color: colors.textMuted, marginRight: spacing(1) },
    myLocationLink: { fontSize: 12 * fontScale, color: colors.primary, fontWeight: "700" },
    radiusRow: { flexDirection: "row", marginBottom: spacing(1.5) },
    radiusChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.6),
      marginRight: spacing(1),
    },
    radiusChipText: { color: colors.text, fontWeight: "600", fontSize: 12 * fontScale },
    error: { color: colors.danger, fontSize: 12 * fontScale, marginHorizontal: spacing(2.5), marginBottom: spacing(1) },
    setupCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.75),
      marginHorizontal: spacing(2.5),
      marginBottom: spacing(1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    setupCardText: { fontSize: 13 * fontScale, color: colors.textMuted },
    setupCardLink: { fontSize: 13 * fontScale, color: colors.primary, fontWeight: "700", marginTop: 6 },
    empty: { color: colors.textMuted, fontSize: 14 * fontScale, textAlign: "center", marginTop: spacing(4) },
    listContent: { paddingHorizontal: spacing(2.5), paddingBottom: spacing(2) },
    footnote: {
      fontSize: 11 * fontScale,
      color: colors.textMuted,
      paddingHorizontal: spacing(2.5),
      paddingBottom: spacing(2),
      lineHeight: 16 * fontScale,
    },
  });
}

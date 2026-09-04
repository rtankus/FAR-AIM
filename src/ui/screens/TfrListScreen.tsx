import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { useLocation } from "../hooks/useLocation";
import { useFavoriteAirports } from "../hooks/useFavoriteAirports";
import { fetchActiveTfrs, tfrDetailUrl } from "../../tfr/api";
import { staleWhileRevalidateTfrs } from "../../tfr/cache";
import { tfrDistanceNm } from "../../tfr/distance";
import { resolveAirportCoords } from "../../tfr/geocode";
import { legalColor } from "../../tfr/format";
import { timeAgo } from "../../weather/format";
import { StalenessBanner } from "../components/WeatherReportCards";
import type { Tfr } from "../../tfr/types";

type Props = NativeStackScreenProps<RootStackParamList, "Tfr">;

type Center = { lat: number; lon: number; label: string } | null;
type Radius = 50 | 100 | 150 | 250 | "all";
const RADII: Radius[] = [50, 100, 150, 250, "all"];

interface Row {
  tfr: Tfr;
  dist: number | null;
}

export default function TfrListScreen({ navigation }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const { locate } = useLocation();
  const { favorites } = useFavoriteAirports(userDb);

  const [allTfrs, setAllTfrs] = useState<Tfr[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [center, setCenter] = useState<Center>(null);
  const [radius, setRadius] = useState<Radius>(100);
  const [locating, setLocating] = useState(false);
  const [searchIdent, setSearchIdent] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await staleWhileRevalidateTfrs(userDb, fetchActiveTfrs, (fresh) => {
        setAllTfrs(fresh.data);
        setFetchedAt(fresh.fetchedAt);
        setStale(fresh.stale);
        setOffline(fresh.offline);
      });
      setAllTfrs(res.data);
      setFetchedAt(res.fetchedAt);
      setStale(res.stale);
      setOffline(res.offline);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [userDb]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setSearchError(null);
    try {
      const coords = await locate();
      if (coords) setCenter({ ...coords, label: "your location" });
      else setSearchError("Location permission is needed to filter by distance from you.");
    } finally {
      setLocating(false);
    }
  }, [locate]);

  // Try to center on the device's location automatically as soon as the
  // screen opens — same as Nearby Weather. If permission is denied, `center`
  // just stays null and the list falls back to showing everything.
  useEffect(() => {
    useMyLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runAirportSearch = useCallback(async (overrideIdent?: string) => {
    const id = (overrideIdent ?? searchIdent).trim().toUpperCase();
    if (!id) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchError(null);
    try {
      const coords = await resolveAirportCoords(userDb, id);
      if (!coords) {
        setSearchError(`Couldn't find "${id}" — check the ICAO identifier.`);
        return;
      }
      setCenter({ ...coords, label: id });
    } catch (err) {
      setSearchError(String(err instanceof Error ? err.message : err));
    } finally {
      setSearching(false);
    }
  }, [searchIdent, userDb]);

  const rows = useMemo<Row[]>(() => {
    if (!center) {
      return allTfrs
        .slice()
        .sort((a, b) => (a.state ?? "").localeCompare(b.state ?? "") || a.title.localeCompare(b.title))
        .map((tfr) => ({ tfr, dist: null }));
    }
    const withDist = allTfrs.map((tfr) => ({ tfr, dist: tfrDistanceNm(tfr, center.lat, center.lon) }));
    const filtered = radius === "all" ? withDist : withDist.filter((r) => r.dist <= radius);
    return filtered.sort((a, b) => a.dist! - b.dist!);
  }, [allTfrs, center, radius]);

  const openMap = useCallback(
    (focusId?: string) => {
      navigation.navigate("TfrMap", {
        focusId,
        center: center ?? undefined,
        radiusNm: radius === "all" ? undefined : radius,
      });
    },
    [navigation, center, radius]
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
                  runAirportSearch(f);
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
            onSubmitEditing={() => runAirportSearch()}
            placeholder="Search near an airport (e.g. KATL)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
          <Pressable
            onPress={() => runAirportSearch()}
            disabled={searching || !searchIdent.trim()}
            style={({ pressed }) => [styles.goButton, (pressed || searching) && { opacity: 0.7 }]}
          >
            <Text style={styles.goButtonText}>{searching ? "…" : "Go"}</Text>
          </Pressable>
        </View>

        <View style={styles.centerRow}>
          <Text style={styles.centerLabel} numberOfLines={1}>
            {center ? `Near ${center.label}` : "Showing all active TFRs"}
          </Text>
          <Pressable onPress={useMyLocation} disabled={locating} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Text style={styles.myLocationLink}>{locating ? "Locating…" : "Use my location"}</Text>
          </Pressable>
        </View>
        {searchError ? <Text style={styles.error}>{searchError}</Text> : null}

        <View style={styles.radiusRow}>
          {RADII.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRadius(r)}
              style={[styles.radiusChip, r === radius && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.radiusChipText, r === radius && { color: "#fff" }]}>
                {r === "all" ? "All" : `${r} nm`}
              </Text>
            </Pressable>
          ))}
        </View>

        {fetchedAt != null ? (
          <StalenessBanner stale={stale} offline={offline} fetchedAtLabel={timeAgo(fetchedAt)} />
        ) : null}
        <Pressable onPress={() => openMap()} style={styles.mapButton}>
          <Text style={styles.mapButtonText}>Map view</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && allTfrs.length === 0 ? <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} /> : null}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.tfr.id}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.empty}>
              {center && radius !== "all"
                ? `No active TFRs within ${radius} nm of ${center.label}.`
                : "No active TFRs are currently published."}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openMap(item.tfr.id)}
            onLongPress={() => Linking.openURL(tfrDetailUrl(item.tfr.id))}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.badge, { backgroundColor: legalColor(item.tfr.legal) }]}>
              <Text style={styles.badgeText}>{item.tfr.state ?? "—"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.tfr.title}
              </Text>
              <Text style={styles.meta}>
                {item.tfr.id} · {item.tfr.legal}
                {item.dist != null ? ` · ${Math.round(item.dist)} nm` : ""}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />

      <Text style={styles.footnote}>
        Data from the FAA's public TFR service. Tap a TFR to see it on the map, or press and hold for the
        FAA's full NOTAM text. The last successful list is cached on-device, so it's still available offline.
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
    mapButton: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      marginBottom: spacing(1.5),
    },
    mapButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 * fontScale },
    error: { color: colors.danger, fontSize: 12 * fontScale, marginBottom: spacing(1) },
    empty: { color: colors.textMuted, fontSize: 14 * fontScale, textAlign: "center", marginTop: spacing(4) },
    listContent: { paddingHorizontal: spacing(2.5), paddingBottom: spacing(5) },
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.5),
      marginBottom: spacing(1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginRight: spacing(1.25) },
    badgeText: { color: "#fff", fontWeight: "700", fontSize: 11 * fontScale },
    title: { fontSize: 14 * fontScale, fontWeight: "600", color: colors.text },
    meta: { fontSize: 11 * fontScale, color: colors.textMuted, marginTop: 2 },
    chevron: { fontSize: 20 * fontScale, color: colors.textMuted, marginLeft: spacing(1) },
    footnote: {
      fontSize: 11 * fontScale,
      color: colors.textMuted,
      paddingHorizontal: spacing(2.5),
      paddingBottom: spacing(2),
      lineHeight: 16 * fontScale,
    },
  });
}

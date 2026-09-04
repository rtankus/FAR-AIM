import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { fetchMetarsByIds, fetchTafsByIds } from "../../weather/api";
import { staleWhileRevalidate } from "../../weather/cache";
import { timeAgo } from "../../weather/format";
import { NEARBY_RADII_NM, useNearbyWeather } from "../hooks/useNearbyWeather";
import { useNearbyTfrs } from "../hooks/useNearbyTfrs";
import { useFavoriteAirports } from "../hooks/useFavoriteAirports";
import { legalColor } from "../../tfr/format";
import { AirSigmetCard, MetarCard, NotamCard, PirepCard, StalenessBanner, TafCard } from "../components/WeatherReportCards";
import type { Metar, Taf } from "../../weather/types";
import { fetchNotamsByLocation, NotamCredentialsMissingError } from "../../notams/api";
import { staleWhileRevalidateNotams } from "../../notams/cache";
import type { Notam } from "../../notams/types";

const TFR_RADII_NM = [50, 100, 150, 250] as const;

type Props = NativeStackScreenProps<RootStackParamList, "Weather">;

interface Result {
  metar: Metar | null;
  taf: Taf | null;
  fetchedAt: number;
  stale: boolean;
  offline: boolean;
  notams: Notam[];
  notamsSetupNeeded: boolean;
}

export default function WeatherScreen({ navigation }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [ident, setIdent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const nearby = useNearbyWeather(userDb);
  const { favorites, toggleFavorite, isFavorite } = useFavoriteAirports(userDb);
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<TabParamList>>();
  const [tfrRadius, setTfrRadius] = useState<(typeof TFR_RADII_NM)[number]>(100);
  const tfrs = useNearbyTfrs(userDb, tfrRadius);
  const [nearbyExpanded, setNearbyExpanded] = useState(true);
  const [tfrExpanded, setTfrExpanded] = useState(true);

  const runSearch = useCallback(async (overrideIdent?: string) => {
    const id = (overrideIdent ?? ident).trim().toUpperCase();
    if (!id) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setResult(null);
    // A background refresh (from staleWhileRevalidate) can land after the
    // user has already searched something else — only apply it if this
    // search is still the one on screen.
    const applyIfCurrent = (updater: (prev: Result | null) => Result | null) =>
      setResult((prev) => (prev?.metar?.icaoId === id || prev?.taf?.icaoId === id || !prev ? updater(prev) : prev));
    try {
      const [metarRes, tafRes, notamOutcome] = await Promise.all([
        staleWhileRevalidate(userDb, `metar:${id}`, () => fetchMetarsByIds([id]), (fresh) =>
          applyIfCurrent((prev) => ({
            ...(prev as Result),
            metar: fresh.data[0] ?? null,
            fetchedAt: fresh.fetchedAt,
            stale: fresh.stale,
            offline: fresh.offline,
          }))
        ),
        staleWhileRevalidate(userDb, `taf:${id}`, () => fetchTafsByIds([id]), (fresh) =>
          applyIfCurrent((prev) => ({
            ...(prev as Result),
            taf: fresh.data[0] ?? null,
          }))
        ).catch(() => null),
        staleWhileRevalidateNotams(userDb, `notam:${id}`, () => fetchNotamsByLocation(userDb, id), (fresh) =>
          applyIfCurrent((prev) => ({ ...(prev as Result), notams: fresh.data }))
        )
          .then((res) => ({ notams: res.data, setupNeeded: false }))
          .catch((err) => ({ notams: [] as Notam[], setupNeeded: err instanceof NotamCredentialsMissingError })),
      ]);
      if (!metarRes.data[0] && !tafRes?.data[0]) {
        setError(`No current METAR/TAF found for "${id}". Check the ICAO identifier.`);
        return;
      }
      setResult({
        metar: metarRes.data[0] ?? null,
        taf: tafRes?.data[0] ?? null,
        fetchedAt: metarRes.fetchedAt,
        stale: metarRes.stale || !!tafRes?.stale,
        offline: metarRes.offline || !!tafRes?.offline,
        notams: notamOutcome.notams,
        notamsSetupNeeded: notamOutcome.setupNeeded,
      });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [ident, userDb]);

  const metarCount = nearby.rows.filter((r) => r.kind === "metar").length;
  const advisoryCount = nearby.rows.filter((r) => r.kind === "airsigmet").length;
  const pirepCount = nearby.rows.filter((r) => r.kind === "pirep").length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <NavRow
        label="Graphical Forecast (GFA)"
        hint="Ceiling & visibility map"
        onPress={() => navigation.navigate("GfaMap")}
      />
      <NavRow
        label="NOTAMs"
        hint="Search by airport or find nearby (FAA test feed)"
        onPress={() => navigation.navigate("Notams")}
      />

      <Text style={styles.label}>Airport identifier</Text>
      {favorites.length > 0 ? (
        <View style={styles.favRow}>
          {favorites.map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                setIdent(f);
                runSearch(f);
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
          value={ident}
          onChangeText={setIdent}
          onSubmitEditing={() => runSearch()}
          placeholder="e.g. KJFK, KORD"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          style={styles.input}
        />
        <Pressable
          onPress={() => runSearch()}
          disabled={loading || !ident.trim()}
          style={({ pressed }) => [styles.button, (pressed || loading) && { opacity: 0.7 }]}
        >
          <Text style={styles.buttonText}>{loading ? "…" : "Go"}</Text>
        </Pressable>
        <Pressable
          onPress={() => toggleFavorite(ident)}
          disabled={!ident.trim()}
          hitSlop={8}
          style={({ pressed }) => [styles.starButton, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.starIcon}>{ident.trim() && isFavorite(ident) ? "★" : "☆"}</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result ? (
        <View style={{ marginTop: spacing(2) }}>
          <StalenessBanner stale={result.stale} offline={result.offline} fetchedAtLabel={timeAgo(result.fetchedAt)} />
          {result.metar ? <MetarCard metar={result.metar} /> : null}
          {result.taf ? <TafCard taf={result.taf} /> : null}

          {result.notamsSetupNeeded ? (
            <Pressable onPress={() => tabNavigation?.navigate("SettingsTab", { screen: "Settings" })} style={styles.setupCard}>
              <Text style={styles.setupCardText}>Add your FAA NOTAM API credentials in Settings to see NOTAMs here too.</Text>
              <Text style={styles.setupCardLink}>Open Settings ›</Text>
            </Pressable>
          ) : result.notams.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>NOTAMs</Text>
              {result.notams.map((n) => (
                <NotamCard key={n.id} notam={n} />
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.sectionHeaderRow}>
        <Pressable onPress={() => setNearbyExpanded((e) => !e)} style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Nearby</Text>
          <Text style={styles.collapseChevron}>{nearbyExpanded ? "▲" : "▼"}</Text>
        </Pressable>
        <View style={styles.radiusRow}>
          {NEARBY_RADII_NM.map((r) => (
            <Pressable
              key={r}
              onPress={() => nearby.setRadius(r)}
              style={[
                styles.radiusChip,
                r === nearby.radius && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text style={[styles.radiusChipText, r === nearby.radius && { color: "#fff" }]}>{r} nm</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {nearby.rows.length > 0 ? (
        <Text style={styles.countLine}>
          {metarCount} METAR{metarCount === 1 ? "" : "s"} · {advisoryCount} AIRMET/SIGMET
          {advisoryCount === 1 ? "" : "s"} · {pirepCount} PIREP{pirepCount === 1 ? "" : "s"}
        </Text>
      ) : null}

      {nearby.meta ? (
        <StalenessBanner stale={nearby.meta.stale} offline={nearby.meta.offline} fetchedAtLabel={timeAgo(nearby.meta.fetchedAt)} />
      ) : null}

      {!nearbyExpanded ? null : nearby.loading && nearby.rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} />
      ) : nearby.error && nearby.rows.length === 0 ? (
        <View>
          <Text style={styles.error}>{nearby.error}</Text>
          <Pressable onPress={nearby.refresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : nearby.rows.length === 0 ? (
        <Text style={styles.emptyText}>No reporting stations or advisories within {nearby.radius} nm.</Text>
      ) : (
        <View style={{ marginTop: spacing(1) }}>
          {nearby.rows.map((row) => {
            if (row.kind === "metar") return <MetarCard key={row.key} metar={row.data} distanceNm={row.dist} />;
            if (row.kind === "airsigmet") return <AirSigmetCard key={row.key} item={row.data} />;
            return <PirepCard key={row.key} item={row.data} distanceNm={row.dist ?? undefined} />;
          })}
        </View>
      )}

      <View style={styles.divider} />

      <View style={styles.sectionHeaderRow}>
        <Pressable onPress={() => setTfrExpanded((e) => !e)} style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Nearby TFRs</Text>
          <Text style={styles.collapseChevron}>{tfrExpanded ? "▲" : "▼"}</Text>
        </Pressable>
        <View style={styles.radiusRow}>
          {TFR_RADII_NM.map((r) => (
            <Pressable
              key={r}
              onPress={() => setTfrRadius(r)}
              style={[
                styles.radiusChip,
                r === tfrRadius && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text style={[styles.radiusChipText, r === tfrRadius && { color: "#fff" }]}>{r} nm</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tfrs.meta ? (
        <StalenessBanner stale={tfrs.meta.stale} offline={tfrs.meta.offline} fetchedAtLabel={timeAgo(tfrs.meta.fetchedAt)} />
      ) : null}

      {!tfrExpanded ? null : tfrs.loading && tfrs.rows.length === 0 ? (
        <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} />
      ) : tfrs.error ? (
        <View>
          <Text style={styles.error}>{tfrs.error}</Text>
          <Pressable onPress={tfrs.refresh} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : tfrs.rows.length === 0 ? (
        <Text style={styles.emptyText}>No active TFRs within {tfrRadius} nm.</Text>
      ) : (
        tfrs.rows.map((r) => (
          <Pressable
            key={r.tfr.id}
            onPress={() => navigation.navigate("TfrMap", { focusId: r.tfr.id })}
            style={styles.tfrRow}
          >
            <View style={[styles.tfrDot, { backgroundColor: legalColor(r.tfr.legal) }]} />
            <Text style={styles.tfrRowText} numberOfLines={1}>
              {r.tfr.title}
            </Text>
            <Text style={styles.tfrRowDist}>{Math.round(r.dist)} nm</Text>
          </Pressable>
        ))
      )}

      <NavRow
        label="Full TFR list & map"
        hint="Search other airports, adjust radius, see it on the map"
        onPress={() => navigation.navigate("Tfr")}
      />

      <Text style={styles.footnote}>
        Data from aviationweather.gov and the FAA's public TFR service. Successful lookups are cached
        on-device so the last-known report is still available if you check again with no connection.
      </Text>
    </ScrollView>
  );
}

function NavRow({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.navRowLabel}>{label}</Text>
        <Text style={styles.navRowHint}>{hint}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    label: { fontSize: 13 * fontScale, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
    searchRow: { flexDirection: "row" },
    input: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      color: colors.text,
      fontSize: 16 * fontScale,
      marginRight: spacing(1),
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: spacing(2.5),
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 * fontScale },
    starButton: { justifyContent: "center", alignItems: "center", paddingLeft: spacing(1.25) },
    starIcon: { fontSize: 22 * fontScale, color: colors.primary },
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
    setupCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.75),
      marginTop: spacing(1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    setupCardText: { fontSize: 13 * fontScale, color: colors.textMuted },
    setupCardLink: { fontSize: 13 * fontScale, color: colors.primary, fontWeight: "700", marginTop: 6 },
    error: { color: colors.danger, fontSize: 13 * fontScale, marginTop: spacing(2) },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing(3) },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing(1),
    },
    sectionTitleRow: { flexDirection: "row", alignItems: "center" },
    sectionTitle: { fontSize: 13 * fontScale, fontWeight: "700", color: colors.textMuted },
    collapseChevron: { fontSize: 10 * fontScale, color: colors.textMuted, marginLeft: spacing(0.75) },
    radiusRow: { flexDirection: "row" },
    radiusChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
      marginLeft: spacing(0.75),
    },
    radiusChipText: { color: colors.text, fontWeight: "600", fontSize: 11.5 * fontScale },
    countLine: { color: colors.textMuted, fontSize: 12 * fontScale, marginBottom: spacing(1) },
    emptyText: { color: colors.textMuted, fontSize: 13 * fontScale, textAlign: "center", marginTop: spacing(2) },
    retryButton: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: spacing(2),
      paddingVertical: spacing(1),
      marginTop: spacing(1),
    },
    retryButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 * fontScale },
    tfrRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
    tfrDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing(1) },
    tfrRowText: { flex: 1, fontSize: 12.5 * fontScale, color: colors.text },
    tfrRowDist: { fontSize: 11 * fontScale, color: colors.textMuted, marginLeft: spacing(1) },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.75),
      marginBottom: spacing(1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    navRowLabel: { fontSize: 15 * fontScale, fontWeight: "700", color: colors.text },
    navRowHint: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 2 },
    chevron: { fontSize: 22 * fontScale, color: colors.textMuted, marginLeft: spacing(1) },
    footnote: { fontSize: 11 * fontScale, color: colors.textMuted, marginTop: spacing(3), lineHeight: 16 * fontScale },
  });
}

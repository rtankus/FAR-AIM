import { useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { useNearbyWeather } from "../hooks/useNearbyWeather";
import { useNearbyTfrs } from "../hooks/useNearbyTfrs";
import { flightCategoryColor, timeAgo } from "../../weather/format";
import { decodeAltimeter, decodeClouds, decodeTemp, decodeVisibility, decodeWind, decodeWxString } from "../../weather/decode";
import { PirepCard, StalenessBanner } from "./WeatherReportCards";
import { Collapsible } from "./Collapsible";
import { EmbeddedGfaMap } from "./EmbeddedGfaMap";
import { EmbeddedTfrMap } from "./EmbeddedTfrMap";

const TFR_RADIUS_NM = 100;

export interface PreflightBriefingPanelProps {
  onOpenWeather: () => void;
  onOpenTfr: () => void;
  onOpenGfa: () => void;
  onOpenNotams: () => void;
  /** Pass false to render without its own ScrollView/pull-to-refresh, when embedding inside another scroll container. */
  scrollable?: boolean;
}

/**
 * Nearby weather + TFRs at a glance. Used standalone (its own scroll +
 * pull-to-refresh) or embedded inside a larger screen's own ScrollView (e.g.
 * the Home screen) via `scrollable={false}`.
 */
export function PreflightBriefingPanel({
  onOpenWeather,
  onOpenTfr,
  onOpenGfa,
  onOpenNotams,
  scrollable = true,
}: PreflightBriefingPanelProps) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const weather = useNearbyWeather(userDb);
  const tfrs = useNearbyTfrs(userDb, TFR_RADIUS_NM);

  const nearestMetar = weather.rows.find((r) => r.kind === "metar");
  const pireps = weather.rows.filter((r) => r.kind === "pirep");
  const refreshing = weather.loading || tfrs.loading;

  const refresh = () => {
    weather.refresh();
    tfrs.refresh();
  };

  const content = (
    <>
      <Text style={styles.subtitle}>
        Everything near your current position, at a glance{scrollable ? " — pull down to refresh" : ""}.
      </Text>

      {nearestMetar?.kind === "metar" ? (
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroIdent}>{nearestMetar.data.icaoId}</Text>
            {nearestMetar.data.fltCat ? (
              <View style={[styles.heroBadge, { backgroundColor: flightCategoryColor(nearestMetar.data.fltCat) }]}>
                <Text style={styles.heroBadgeText}>{nearestMetar.data.fltCat}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroRaw}>{nearestMetar.data.rawOb}</Text>
          <View style={styles.heroDecoded}>
            <Text style={styles.heroDecodedLine}>
              <Text style={styles.heroDecodedLabel}>Wind: </Text>
              {decodeWind(nearestMetar.data.wdir, nearestMetar.data.wspd, nearestMetar.data.wgst)}
            </Text>
            <Text style={styles.heroDecodedLine}>
              <Text style={styles.heroDecodedLabel}>Visibility: </Text>
              {decodeVisibility(nearestMetar.data.visib)}
            </Text>
            {decodeWxString(nearestMetar.data.wxString).length > 0 ? (
              <Text style={styles.heroDecodedLine}>
                <Text style={styles.heroDecodedLabel}>Weather: </Text>
                {decodeWxString(nearestMetar.data.wxString).join(", ")}
              </Text>
            ) : null}
            {decodeClouds(nearestMetar.data.clouds).map((c, i) => (
              <Text key={i} style={styles.heroDecodedLine}>
                {c}
              </Text>
            ))}
            <Text style={styles.heroDecodedLine}>{decodeTemp(nearestMetar.data.temp, nearestMetar.data.dewp)}</Text>
            <Text style={styles.heroDecodedLine}>
              <Text style={styles.heroDecodedLabel}>Altimeter: </Text>
              {decodeAltimeter(nearestMetar.data.altim)}
            </Text>
          </View>
          <Text style={styles.heroMeta}>Nearest reporting station · {Math.round(nearestMetar.dist)} nm away</Text>
        </View>
      ) : weather.loading ? (
        <ActivityIndicator style={{ marginVertical: spacing(3) }} color={colors.primary} />
      ) : weather.error ? (
        <Text style={styles.error}>{weather.error}</Text>
      ) : null}
      {weather.meta ? (
        <StalenessBanner stale={weather.meta.stale} offline={weather.meta.offline} fetchedAtLabel={timeAgo(weather.meta.fetchedAt)} />
      ) : null}

      <Collapsible title="PIREPs" count={pireps.length} defaultExpanded={false}>
        {pireps.length > 0 ? (
          pireps.map((r) => (r.kind === "pirep" ? <PirepCard key={r.key} item={r.data} distanceNm={r.dist ?? undefined} /> : null))
        ) : (
          <Text style={styles.emptyText}>No PIREPs reported nearby.</Text>
        )}
      </Collapsible>

      <Text style={styles.sectionTitle}>
        Nearby TFRs {tfrs.rows.length > 0 ? `(${tfrs.rows.length} within ${TFR_RADIUS_NM} nm)` : `(none within ${TFR_RADIUS_NM} nm)`}
      </Text>
      {tfrs.error ? <Text style={styles.error}>{tfrs.error}</Text> : null}
      <EmbeddedTfrMap
        tfrs={tfrs.rows.map((r) => r.tfr)}
        center={tfrs.coords ? { ...tfrs.coords, label: "your location" } : undefined}
        radiusNm={TFR_RADIUS_NM}
        deviceCoords={tfrs.coords}
      />
      {tfrs.meta ? (
        <StalenessBanner stale={tfrs.meta.stale} offline={tfrs.meta.offline} fetchedAtLabel={timeAgo(tfrs.meta.fetchedAt)} />
      ) : null}
      <Pressable onPress={onOpenTfr} style={styles.subLink}>
        <Text style={styles.subLinkText}>Full TFR list & map ›</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Graphical Forecast (ceiling & visibility)</Text>
      <EmbeddedGfaMap />
      <Pressable onPress={onOpenGfa} style={styles.subLink}>
        <Text style={styles.subLinkText}>Open full screen ›</Text>
      </Pressable>

      <View style={styles.linkRow}>
        <LinkChip label="All nearby weather" onPress={onOpenWeather} />
        <LinkChip label="NOTAMs" onPress={onOpenNotams} />
      </View>
    </>
  );

  if (!scrollable) return <View style={styles.padded}>{content}</View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {content}
    </ScrollView>
  );
}

function LinkChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkChip, pressed && { opacity: 0.7 }]}>
      <Text style={styles.linkChipText}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    padded: { padding: spacing(2.5) },
    subtitle: { fontSize: 13 * fontScale, color: colors.textMuted, marginBottom: spacing(2) },
    heroCard: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: spacing(2),
      marginBottom: spacing(1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    heroHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    heroIdent: { fontSize: 20 * fontScale, fontWeight: "800", color: colors.text, marginRight: 10 },
    heroBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
    heroBadgeText: { color: "#fff", fontWeight: "800", fontSize: 13 * fontScale },
    heroRaw: { fontSize: 14.5 * fontScale, color: colors.text, fontFamily: "Menlo", lineHeight: 20 * fontScale },
    heroDecoded: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    heroDecodedLine: { fontSize: 12.5 * fontScale, color: colors.text, lineHeight: 18 * fontScale },
    heroDecodedLabel: { fontWeight: "700", color: colors.textMuted },
    heroMeta: { fontSize: 11.5 * fontScale, color: colors.textMuted, marginTop: 6 },
    error: { color: colors.danger, fontSize: 13 * fontScale, marginBottom: spacing(1) },
    emptyText: { color: colors.textMuted, fontSize: 12.5 * fontScale, paddingVertical: spacing(0.5) },
    sectionTitle: {
      fontSize: 13 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      marginTop: spacing(2),
      marginBottom: spacing(1),
    },
    subLink: { alignSelf: "flex-start", marginTop: spacing(0.75), marginBottom: spacing(0.5) },
    subLinkText: { fontSize: 12.5 * fontScale, color: colors.primary, fontWeight: "700" },
    linkRow: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing(1.5) },
    linkChip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(0.75),
      marginRight: spacing(1),
      marginBottom: spacing(1),
    },
    linkChipText: { fontSize: 12.5 * fontScale, color: colors.primary, fontWeight: "700" },
  });
}

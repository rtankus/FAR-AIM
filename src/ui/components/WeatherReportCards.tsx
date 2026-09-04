import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AirSigmet, Metar, Pirep, Taf, TafForecastPeriod } from "../../weather/types";
import { flightCategoryColor, severityLabel, shortTime } from "../../weather/format";
import { decodeAltimeter, decodeClouds, decodeTemp, decodeVisibility, decodeWind, decodeWxString } from "../../weather/decode";
import type { Notam } from "../../notams/types";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

/** Toggle + expandable block, shared by MetarCard/TafCard/NotamCard. */
function DecodeToggle({
  children,
  collapsedLabel = "Decode ▼",
  expandedLabel = "Hide decoded ▲",
}: {
  children: React.ReactNode;
  collapsedLabel?: string;
  expandedLabel?: string;
}) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={6}>
        <Text style={styles.decodeToggle}>{expanded ? expandedLabel : collapsedLabel}</Text>
      </Pressable>
      {expanded ? <View style={styles.decodedBlock}>{children}</View> : null}
    </View>
  );
}

function DecodedLine({ label, value }: { label?: string; value: string }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <Text style={styles.decodedLine}>
      {label ? <Text style={styles.decodedLabel}>{label}: </Text> : null}
      {value}
    </Text>
  );
}

export function MetarCard({ metar, distanceNm }: { metar: Metar; distanceNm?: number }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const obs = shortTime(metar.obsTime);
  const wx = decodeWxString(metar.wxString);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.ident}>{metar.icaoId}</Text>
        {metar.fltCat ? (
          <View style={[styles.badge, { backgroundColor: flightCategoryColor(metar.fltCat) }]}>
            <Text style={styles.badgeText}>{metar.fltCat}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {distanceNm != null ? <Text style={styles.meta}>{Math.round(distanceNm)} nm</Text> : null}
      </View>
      {metar.name ? <Text style={styles.name}>{metar.name}</Text> : null}
      <Text style={styles.raw}>{metar.rawOb}</Text>
      {obs ? <Text style={styles.meta}>Observed {obs}</Text> : null}
      <DecodeToggle>
        <DecodedLine label="Wind" value={decodeWind(metar.wdir, metar.wspd, metar.wgst)} />
        <DecodedLine label="Visibility" value={decodeVisibility(metar.visib)} />
        {wx.length > 0 ? <DecodedLine label="Weather" value={wx.join(", ")} /> : null}
        {decodeClouds(metar.clouds).map((c, i) => (
          <DecodedLine key={i} value={c} />
        ))}
        <DecodedLine value={decodeTemp(metar.temp, metar.dewp)} />
        <DecodedLine label="Altimeter" value={decodeAltimeter(metar.altim)} />
      </DecodeToggle>
    </View>
  );
}

function decodedTafPeriod(f: TafForecastPeriod): string {
  const from = shortTime(f.timeFrom) ?? "?";
  const to = f.timeTo ? shortTime(f.timeTo) : null;
  const change = f.fcstChange ? `${f.fcstChange} ` : "";
  return to ? `${change}${from}–${to}` : `${change}From ${from}`;
}

export function TafCard({ taf }: { taf: Taf }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.ident}>{taf.icaoId}</Text>
        <Text style={styles.sectionLabel}>TAF</Text>
      </View>
      <Text style={styles.raw}>{taf.rawTAF}</Text>
      {taf.issueTime ? <Text style={styles.meta}>Issued {taf.issueTime}</Text> : null}
      {taf.fcsts && taf.fcsts.length > 0 ? (
        <DecodeToggle>
          {taf.fcsts.map((f, i) => {
            const wx = decodeWxString(f.wxString);
            return (
              <View key={i} style={i > 0 ? styles.decodedPeriodDivider : undefined}>
                <DecodedLine value={decodedTafPeriod(f)} />
                <DecodedLine label="Wind" value={decodeWind(f.wdir, f.wspd, f.wgst)} />
                <DecodedLine label="Visibility" value={decodeVisibility(f.visib)} />
                {wx.length > 0 ? <DecodedLine label="Weather" value={wx.join(", ")} /> : null}
                {decodeClouds(f.clouds).map((c, j) => (
                  <DecodedLine key={j} value={c} />
                ))}
              </View>
            );
          })}
        </DecodeToggle>
      ) : null}
    </View>
  );
}

export function AirSigmetCard({ item, distanceNm }: { item: AirSigmet; distanceNm?: number }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.ident}>{item.airSigmetType ?? "Advisory"}</Text>
        <View style={[styles.badge, { backgroundColor: colors.aimBadge }]}>
          <Text style={styles.badgeText}>{severityLabel(item.hazard, item.severity)}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {distanceNm != null ? <Text style={styles.meta}>{Math.round(distanceNm)} nm</Text> : null}
      </View>
      {item.rawAirSigmet ? <Text style={styles.raw}>{item.rawAirSigmet}</Text> : null}
    </View>
  );
}

export function PirepCard({ item, distanceNm }: { item: Pirep; distanceNm?: number }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const obs = shortTime(item.obsTime);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.ident}>{item.icaoId ?? "PIREP"}</Text>
        {item.fltLvl != null ? <Text style={styles.sectionLabel}>FL{item.fltLvl}</Text> : null}
        <View style={{ flex: 1 }} />
        {distanceNm != null ? <Text style={styles.meta}>{Math.round(distanceNm)} nm</Text> : null}
      </View>
      <Text style={styles.raw}>{item.rawOb}</Text>
      {obs ? <Text style={styles.meta}>Reported {obs}</Text> : null}
    </View>
  );
}

export function NotamCard({ notam, distanceNm }: { notam: Notam; distanceNm?: number }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const icaoText = notam.notamTranslation?.find((t) => t.type === "ICAO");
  const local = notam.notamTranslation?.find((t) => t.simpleText);
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.ident}>{notam.icaoLocation ?? notam.location ?? "NOTAM"}</Text>
        {notam.number ? <Text style={styles.sectionLabel}>{notam.number}</Text> : null}
        <View style={{ flex: 1 }} />
        {distanceNm != null ? <Text style={styles.meta}>{Math.round(distanceNm)} nm</Text> : null}
      </View>
      <Text style={styles.raw}>{notam.text ?? local?.simpleText ?? "(no text provided)"}</Text>
      {notam.effectiveStart ? (
        <Text style={styles.meta}>
          Effective {notam.effectiveStart}
          {notam.effectiveEnd ? ` – ${notam.effectiveEnd}` : ""}
        </Text>
      ) : null}
      {icaoText?.formattedText ? (
        <DecodeToggle collapsedLabel="Full ICAO text ▼" expandedLabel="Hide full text ▲">
          <DecodedLine value={icaoText.formattedText} />
        </DecodeToggle>
      ) : null}
    </View>
  );
}

/**
 * Freshness indicator shared by the weather/TFR screens — always shows how
 * old the on-screen data is (matching how EFB apps like ForeFlight label
 * their weather), and escalates to a bordered banner only when there's
 * actually no connectivity to refresh with (as opposed to a background
 * refresh that just hasn't landed yet).
 */
export function StalenessBanner({
  stale,
  offline,
  fetchedAtLabel,
}: {
  stale: boolean;
  offline?: boolean;
  fetchedAtLabel: string;
}) {
  const { colors, spacing, fontScale } = useTheme();
  if (offline) {
    return (
      <View style={[bannerStyles.banner, { backgroundColor: colors.aimBadge + "22", borderColor: colors.aimBadge }]}>
        <Text style={[bannerStyles.text, { color: colors.text, fontSize: 12 * fontScale }]}>
          Offline — showing cached data from {fetchedAtLabel}
        </Text>
      </View>
    );
  }
  return (
    <Text style={[bannerStyles.freshness, { color: colors.textMuted, fontSize: 11 * fontScale, marginBottom: spacing(1) }]}>
      {stale ? `Updated ${fetchedAtLabel} — refreshing…` : `Updated ${fetchedAtLabel}`}
    </Text>
  );
}

const bannerStyles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8 },
  text: { fontWeight: "600" },
  freshness: {},
});

function makeCardStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing(1.75),
      marginBottom: spacing(1.5),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    ident: { fontSize: 16 * fontScale, fontWeight: "800", color: colors.text, marginRight: 8 },
    name: { fontSize: 12 * fontScale, color: colors.textMuted, marginBottom: 4 },
    sectionLabel: { fontSize: 12 * fontScale, fontWeight: "700", color: colors.textMuted },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 },
    badgeText: { color: "#fff", fontWeight: "700", fontSize: 11 * fontScale },
    raw: { fontSize: 13.5 * fontScale, color: colors.text, fontFamily: "Menlo", lineHeight: 19 * fontScale },
    meta: { fontSize: 11 * fontScale, color: colors.textMuted, marginTop: 4 },
    decodeToggle: { fontSize: 12 * fontScale, color: colors.primary, fontWeight: "700", marginTop: 8 },
    decodedBlock: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    decodedLine: { fontSize: 12.5 * fontScale, color: colors.text, lineHeight: 18 * fontScale },
    decodedLabel: { fontWeight: "700", color: colors.textMuted },
    decodedPeriodDivider: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAirportsDb } from "../AirportsDbContext";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { getAirport, getCharts, getFrequencies, getProcedures, getRunways } from "../../airports/queries";
import AirportsDataFreshness from "../components/AirportsDataFreshness";
import { useAirportDensityAltitude } from "../hooks/useAirportDensityAltitude";
import { decodeAltimeter, decodeTemp } from "../../weather/decode";
import { timeAgo } from "../../weather/format";
import { CHART_CODE_LABEL, type Airport, type Frequency, type Procedure, type ProcedureChart, type Runway } from "../../airports/types";

type Props = NativeStackScreenProps<RootStackParamList, "AirportDetail">;

const PROCEDURE_TYPE_LABEL = { SID: "Departures (SID)", STAR: "Arrivals (STAR)", APPROACH: "Approaches" } as const;

export default function AirportDetailScreen({ route, navigation }: Props) {
  const { ident } = route.params;
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const airportsDb = useAirportsDb();
  const userDb = useUserDb();

  const [airport, setAirport] = useState<Airport | null>(null);
  const [runways, setRunways] = useState<Runway[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
  const [charts, setCharts] = useState<ProcedureChart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!airportsDb) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getAirport(airportsDb, ident),
      getRunways(airportsDb, ident),
      getProcedures(airportsDb, ident),
      getFrequencies(airportsDb, ident),
      getCharts(airportsDb, ident),
    ]).then(([a, r, p, f, c]) => {
      if (cancelled) return;
      setAirport(a);
      setRunways(r);
      setProcedures(p);
      setFrequencies(f);
      setCharts(c);
      setLoading(false);
      navigation.setOptions({ title: a?.ident ?? ident });
    });
    return () => {
      cancelled = true;
    };
  }, [airportsDb, ident, navigation]);

  const densityAltitudeParams = useMemo(
    () =>
      airport && airport.elev_ft != null
        ? { ident: airport.ident, lat: airport.lat, lon: airport.lon, elevationFt: airport.elev_ft }
        : null,
    [airport]
  );
  const { result: densityAltitude, loading: densityAltitudeLoading, error: densityAltitudeError } =
    useAirportDensityAltitude(userDb, densityAltitudeParams);

  if (!airportsDb || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!airport) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>No data found for {ident}.</Text>
      </View>
    );
  }

  const proceduresByType = (["SID", "STAR", "APPROACH"] as const).map((type) => ({
    type,
    items: procedures.filter((p) => p.type === type),
  }));
  const chartsByCode = (["APD", "DP", "STAR", "IAP"] as const).map((code) => ({
    code,
    items: charts.filter((c) => c.chart_code === code),
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{airport.name}</Text>
      <Text style={styles.subtitle}>
        {[airport.city, airport.state].filter(Boolean).join(", ")}
        {airport.elev_ft != null ? ` · ${airport.elev_ft} ft elev` : ""}
      </Text>

      {densityAltitudeParams ? (
        <Section title="Density Altitude">
          {densityAltitudeLoading && !densityAltitude ? (
            <ActivityIndicator color={colors.primary} />
          ) : densityAltitude ? (
            <>
              <Row
                label="Pressure altitude"
                value={`${Math.round(densityAltitude.pressureAltitudeFt).toLocaleString()} ft`}
                styles={styles}
              />
              <Row
                label="Density altitude"
                value={`${Math.round(densityAltitude.densityAltitudeFt).toLocaleString()} ft`}
                styles={styles}
              />
              <Text style={styles.footnote}>
                {densityAltitude.sourceDistanceNm != null
                  ? `From ${densityAltitude.metar.icaoId}, ${Math.round(densityAltitude.sourceDistanceNm)} nm away (nearest reporting station) — `
                  : `From ${densityAltitude.metar.icaoId}'s own METAR — `}
                {decodeAltimeter(densityAltitude.metar.altim)} · {decodeTemp(densityAltitude.metar.temp, densityAltitude.metar.dewp)}
                {"\n"}Updated {timeAgo(densityAltitude.fetchedAt)}
                {densityAltitude.stale ? " (cached)" : ""}
              </Text>
            </>
          ) : densityAltitudeError ? (
            <Text style={styles.empty}>{densityAltitudeError}</Text>
          ) : null}
        </Section>
      ) : null}

      {runways.length > 0 ? (
        <Section title="Runways">
          {runways.map((r) => (
            <Row
              key={r.ident}
              label={r.ident}
              value={[r.length_ft && r.width_ft ? `${r.length_ft}×${r.width_ft} ft` : null, r.surface]
                .filter(Boolean)
                .join(" · ")}
              styles={styles}
            />
          ))}
        </Section>
      ) : null}

      {frequencies.length > 0 ? (
        <Section title="Frequencies">
          {frequencies.map((f, i) => (
            <Row key={i} label={f.name ?? f.type} value={`${f.freq_mhz.toFixed(3)} · ${f.type}`} styles={styles} />
          ))}
        </Section>
      ) : null}

      {proceduresByType.map(({ type, items }) =>
        items.length > 0 ? (
          <Section key={type} title={PROCEDURE_TYPE_LABEL[type]}>
            {items.map((p, i) => (
              <Row
                key={i}
                label={p.name}
                value=""
                onPress={() => navigation.navigate("ProcedurePlate", { airportIdent: airport.ident, type: p.type, name: p.name })}
                styles={styles}
              />
            ))}
          </Section>
        ) : null
      )}

      {chartsByCode.map(({ code, items }) =>
        items.length > 0 ? (
          <Section key={code} title={CHART_CODE_LABEL[code]}>
            {items.map((c, i) => (
              <Row
                key={i}
                label={c.chart_name}
                value=""
                onPress={() =>
                  navigation.navigate("ChartViewer", { airportIdent: airport.ident, chartName: c.chart_name, pdfUrl: c.pdf_url })
                }
                styles={styles}
              />
            ))}
          </Section>
        ) : null
      )}

      <AirportsDataFreshness style={styles.footnote} />
      <Text style={styles.footnote}>
        Charts are the FAA's official published PDFs for the current cycle — open one to view it, and optionally
        save it for offline use. Everything above (runways, frequencies, procedure text) is bundled on-device
        already; charts are fetched on demand since bundling every airport's PDFs would be gigabytes. Not for
        navigation.
      </Text>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  const { colors, fontScale } = useTheme();
  return (
    <Text style={{ fontSize: 12 * fontScale, fontWeight: "700", color: colors.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
      {children}
    </Text>
  );
}

function Row({
  label,
  value,
  onPress,
  styles,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, onPress && pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress ? <Text style={styles.rowChevron}>›</Text> : null}
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    empty: { color: colors.textMuted, fontSize: 14 * fontScale },
    name: { fontSize: 20 * fontScale, fontWeight: "700", color: colors.text },
    subtitle: { fontSize: 13 * fontScale, color: colors.textMuted, marginTop: 4 },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      marginBottom: spacing(0.75),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rowLabel: { fontSize: 13 * fontScale, fontWeight: "600", color: colors.text },
    rowValue: { fontSize: 12 * fontScale, color: colors.textMuted },
    rowChevron: { fontSize: 16 * fontScale, color: colors.textMuted, marginLeft: spacing(1) },
    footnote: {
      fontSize: 11 * fontScale,
      color: colors.textMuted,
      marginTop: spacing(3),
      lineHeight: 16 * fontScale,
    },
  });
}

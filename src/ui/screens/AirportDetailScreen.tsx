import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAirportsDb } from "../AirportsDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { getAirport, getFrequencies, getProcedures, getRunways } from "../../airports/queries";
import AirportsDataFreshness from "../components/AirportsDataFreshness";
import type { Airport, Frequency, Procedure, Runway } from "../../airports/types";

type Props = NativeStackScreenProps<RootStackParamList, "AirportDetail">;

const PROCEDURE_TYPE_LABEL = { SID: "Departures (SID)", STAR: "Arrivals (STAR)", APPROACH: "Approaches" } as const;

export default function AirportDetailScreen({ route, navigation }: Props) {
  const { ident } = route.params;
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const airportsDb = useAirportsDb();

  const [airport, setAirport] = useState<Airport | null>(null);
  const [runways, setRunways] = useState<Runway[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [frequencies, setFrequencies] = useState<Frequency[]>([]);
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
    ]).then(([a, r, p, f]) => {
      if (cancelled) return;
      setAirport(a);
      setRunways(r);
      setProcedures(p);
      setFrequencies(f);
      setLoading(false);
      navigation.setOptions({ title: a?.ident ?? ident });
    });
    return () => {
      cancelled = true;
    };
  }, [airportsDb, ident, navigation]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.name}>{airport.name}</Text>
      <Text style={styles.subtitle}>
        {[airport.city, airport.state].filter(Boolean).join(", ")}
        {airport.elev_ft != null ? ` · ${airport.elev_ft} ft elev` : ""}
      </Text>

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
              <Row key={i} label={p.name} value="" styles={styles} />
            ))}
          </Section>
        ) : null
      )}

      <AirportsDataFreshness style={styles.footnote} />
      <Text style={styles.footnote}>
        Procedure names only — not full route/leg data. Not for navigation.
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
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
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
    footnote: {
      fontSize: 11 * fontScale,
      color: colors.textMuted,
      marginTop: spacing(3),
      lineHeight: 16 * fontScale,
    },
  });
}

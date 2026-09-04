import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAirportsDb } from "../AirportsDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { getCharts, getProcedureLegs } from "../../airports/queries";
import { PATH_TERMINATOR_LABEL, WAYPOINT_DESC_LABEL, type ProcedureChart, type ProcedureLeg } from "../../airports/types";
import AirportsDataFreshness from "../components/AirportsDataFreshness";

type Props = NativeStackScreenProps<RootStackParamList, "ProcedurePlate">;

const CHART_CODE_FOR_PROC_TYPE = { SID: "DP", STAR: "STAR", APPROACH: "IAP" } as const;
const NUMBER_WORD: Record<string, string> = {
  "1": "ONE",
  "2": "TWO",
  "3": "THREE",
  "4": "FOUR",
  "5": "FIVE",
  "6": "SIX",
  "7": "SEVEN",
  "8": "EIGHT",
  "9": "NINE",
};

/**
 * Best-effort match between a parsed CIFP procedure and the FAA's own chart
 * PDFs — CIFP idents ("DEEZZ6", "I04L") and chart titles ("DEEZZ SIX
 * DEPARTURE", "ILS OR LOC RWY 04L") aren't the same string, so this is a
 * heuristic (runway-number overlap for approaches, base-fix-name + spelled-
 * out revision number for SID/STAR), not a guaranteed link — shown as a
 * pickable list rather than assumed correct.
 */
function findRelatedCharts(charts: ProcedureChart[], type: Props["route"]["params"]["type"], name: string, legs: ProcedureLeg[]): ProcedureChart[] {
  const chartCode = CHART_CODE_FOR_PROC_TYPE[type];
  const candidates = charts.filter((c) => c.chart_code === chartCode);
  const upperName = name.toUpperCase();

  const runwayTokens = new Set<string>();
  for (const leg of legs) {
    const m = leg.transition_ident.match(/^RW(\d{2}[LRC]?)/);
    if (m) runwayTokens.add(m[1]);
  }
  const nameRunway = upperName.match(/(\d{2}[LRC]?)$/)?.[1];
  if (nameRunway) runwayTokens.add(nameRunway);

  const baseName = upperName.replace(/\d+$/, "");
  const trailingDigit = upperName.match(/(\d)$/)?.[1];
  const numberWord = trailingDigit ? NUMBER_WORD[trailingDigit] : null;

  return candidates.filter((c) => {
    const cn = c.chart_name.toUpperCase();
    for (const t of runwayTokens) if (cn.includes(t)) return true;
    if (baseName.length >= 3 && cn.includes(baseName)) return true;
    if (numberWord && cn.includes(numberWord)) return true;
    return false;
  });
}

function formatAltitude(leg: ProcedureLeg): string | null {
  if (leg.alt1 == null) return null;
  switch (leg.alt_desc) {
    case "+":
      return `At or above ${leg.alt1} ft`;
    case "-":
      return `At or below ${leg.alt1} ft`;
    case "@":
      return `At ${leg.alt1} ft`;
    case "B":
      return leg.alt2 != null ? `${leg.alt1}–${leg.alt2} ft` : `At or above ${leg.alt1} ft`;
    default: {
      // CIFP leaves the altitude-description character blank on plenty of
      // legs that still carry a numeric alt1/alt2 — rather than guess at
      // "at/above/below" semantics with no descriptor to back it up, show
      // the raw value(s) plainly and let the chart be the authority on
      // what they mean.
      if (leg.alt2 == null || leg.alt2 === leg.alt1) return `Alt ${leg.alt1} ft`;
      const [lo, hi] = leg.alt1 < leg.alt2 ? [leg.alt1, leg.alt2] : [leg.alt2, leg.alt1];
      return `Alt ${lo}–${hi} ft`;
    }
  }
}

function legMatches(leg: ProcedureLeg, query: string): boolean {
  if (!query) return true;
  const q = query.toUpperCase();
  return (
    (leg.fix_ident?.includes(q) ?? false) ||
    (leg.desc_code != null && WAYPOINT_DESC_LABEL[leg.desc_code].toUpperCase().includes(q))
  );
}

export default function ProcedurePlateScreen({ route, navigation }: Props) {
  const { airportIdent, type, name } = route.params;
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const airportsDb = useAirportsDb();
  const [legs, setLegs] = useState<ProcedureLeg[]>([]);
  const [charts, setCharts] = useState<ProcedureChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    navigation.setOptions({ title: name });
  }, [navigation, name]);

  useEffect(() => {
    if (!airportsDb) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getProcedureLegs(airportsDb, airportIdent, type, name), getCharts(airportsDb, airportIdent)]).then(
      ([legRows, chartRows]) => {
        if (!cancelled) {
          setLegs(legRows);
          setCharts(chartRows);
          setLoading(false);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [airportsDb, airportIdent, type, name]);

  const relatedCharts = useMemo(() => findRelatedCharts(charts, type, name, legs), [charts, type, name, legs]);

  const transitions = useMemo(() => {
    const byTransition = new Map<string, ProcedureLeg[]>();
    for (const leg of legs) {
      if (!byTransition.has(leg.transition_ident)) byTransition.set(leg.transition_ident, []);
      byTransition.get(leg.transition_ident)!.push(leg);
    }
    return [...byTransition.entries()]
      .map(([transitionIdent, transitionLegs]) => ({
        transitionIdent,
        legs: transitionLegs.filter((l) => legMatches(l, query)),
      }))
      .filter((t) => t.legs.length > 0);
  }, [legs, query]);

  if (!airportsDb || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>
        {airportIdent} · {type}
      </Text>

      {relatedCharts.length > 0 ? (
        <View style={styles.chartSection}>
          <Text style={styles.chartSectionTitle}>Official FAA chart{relatedCharts.length > 1 ? "s" : ""} (verify it's the right one)</Text>
          {relatedCharts.map((c) => (
            <Pressable
              key={c.pdf_url}
              onPress={() => navigation.navigate("ChartViewer", { airportIdent, chartName: c.chart_name, pdfUrl: c.pdf_url })}
              style={({ pressed }) => [styles.chartRow, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.chartRowText}>{c.chart_name}</Text>
              <Text style={styles.rowChevronInline}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search waypoint, IAF, IF, FAF, MAP…"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.searchInput}
      />

      {transitions.length === 0 ? (
        <Text style={styles.empty}>{query ? "No fixes match." : "No leg data available for this procedure."}</Text>
      ) : (
        transitions.map(({ transitionIdent, legs: transitionLegs }) => (
          <View key={transitionIdent} style={styles.transitionSection}>
            <Text style={styles.transitionTitle}>{transitionIdent}</Text>
            {transitionLegs.map((leg, i) => {
              const altText = formatAltitude(leg);
              const terminatorLabel = leg.path_terminator ? PATH_TERMINATOR_LABEL[leg.path_terminator] : null;
              return (
                <View key={i} style={styles.legRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.legHeaderRow}>
                      <Text style={styles.fixIdent}>{leg.fix_ident ?? "—"}</Text>
                      {leg.desc_code ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{WAYPOINT_DESC_LABEL[leg.desc_code]}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.legMeta}>
                      {terminatorLabel ?? leg.path_terminator ?? "—"}
                      {altText ? ` · ${altText}` : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}

      <AirportsDataFreshness style={styles.footnote} />
      <Text style={styles.footnote}>
        Parsed from raw FAA CIFP fixed-width fields — cross-check altitudes and fix sequence against the official
        published chart before use. Not for navigation.
      </Text>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
    subtitle: { fontSize: 13 * fontScale, color: colors.textMuted, marginBottom: spacing(1.5) },
    chartSection: { marginBottom: spacing(2) },
    chartSectionTitle: {
      fontSize: 12 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      marginBottom: spacing(0.75),
      textTransform: "uppercase",
    },
    chartRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      marginBottom: spacing(0.6),
    },
    chartRowText: { color: "#fff", fontWeight: "700", fontSize: 13 * fontScale, flex: 1 },
    rowChevronInline: { color: "#fff", fontSize: 16 * fontScale, marginLeft: spacing(1) },
    searchInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      color: colors.text,
      fontSize: 14 * fontScale,
      marginBottom: spacing(2),
    },
    empty: { color: colors.textMuted, fontSize: 14 * fontScale, textAlign: "center", marginTop: spacing(4) },
    transitionSection: { marginBottom: spacing(2.5) },
    transitionTitle: {
      fontSize: 12 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      marginBottom: spacing(0.75),
      textTransform: "uppercase",
    },
    legRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1),
      marginBottom: spacing(0.6),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    legHeaderRow: { flexDirection: "row", alignItems: "center" },
    fixIdent: { fontSize: 14 * fontScale, fontWeight: "700", color: colors.text, marginRight: spacing(1) },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 5,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    badgeText: { color: "#fff", fontWeight: "700", fontSize: 10 * fontScale },
    legMeta: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 2 },
    footnote: {
      fontSize: 11 * fontScale,
      color: colors.textMuted,
      marginTop: spacing(2),
      lineHeight: 16 * fontScale,
    },
  });
}

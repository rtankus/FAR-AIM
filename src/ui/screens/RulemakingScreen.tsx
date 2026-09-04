import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { fetchRecentFaaRulemaking } from "../../rulemaking/api";
import { cachedFetchRulemaking } from "../../rulemaking/cache";
import { timeAgo } from "../../weather/format";
import type { RulemakingDocument } from "../../rulemaking/types";

type Props = NativeStackScreenProps<RootStackParamList, "Rulemaking">;

export default function RulemakingScreen(_props: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [docs, setDocs] = useState<RulemakingDocument[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = force
          ? { data: await fetchRecentFaaRulemaking(20), fetchedAt: Date.now(), stale: false }
          : await cachedFetchRulemaking(userDb, 20, () => fetchRecentFaaRulemaking(20));
        setDocs(res.data);
        setFetchedAt(res.fetchedAt);
        setStale(res.stale);
      } catch (err) {
        setError(String(err instanceof Error ? err.message : err));
      } finally {
        setLoading(false);
      }
    },
    [userDb]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(true)} tintColor={colors.primary} />}
    >
      <Text style={styles.subtitle}>Recently published FAA rules and proposed rules, from the Federal Register.</Text>

      {stale && fetchedAt ? (
        <View style={styles.staleBanner}>
          <Text style={styles.staleText}>Showing cached results from {timeAgo(fetchedAt)} — pull to refresh.</Text>
        </View>
      ) : null}

      {loading && !docs ? <ActivityIndicator style={{ marginTop: spacing(3) }} color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {docs?.map((doc) => <RulemakingRow key={doc.documentNumber} doc={doc} />)}

      {fetchedAt && !stale ? (
        <Text style={styles.footnote}>Updated {timeAgo(fetchedAt)}. Requires an internet connection to refresh.</Text>
      ) : null}
    </ScrollView>
  );
}

function RulemakingRow({ doc }: { doc: RulemakingDocument }) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  return (
    <Pressable
      onPress={() => Linking.openURL(doc.htmlUrl)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.rowHeader}>
        <Text style={[styles.typeBadge, doc.type === "Rule" ? styles.typeRule : styles.typeProposed]}>
          {doc.type === "Rule" ? "FINAL RULE" : "PROPOSED"}
        </Text>
        <Text style={styles.rowDate}>{doc.publicationDate}</Text>
      </View>
      <Text style={styles.rowTitle}>{doc.title}</Text>
      {doc.abstract ? (
        <Text style={styles.rowAbstract} numberOfLines={3}>
          {doc.abstract}
        </Text>
      ) : null}
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing(2.5), paddingBottom: spacing(5) },
    subtitle: { fontSize: 13 * fontScale, color: colors.textMuted, marginBottom: spacing(2) },
    staleBanner: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.5),
      marginBottom: spacing(2),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    staleText: { fontSize: 12 * fontScale, color: colors.textMuted },
    error: { color: colors.danger, fontSize: 13 * fontScale, marginTop: spacing(2) },
    row: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.75),
      marginBottom: spacing(1.25),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    typeBadge: { fontSize: 10 * fontScale, fontWeight: "800", letterSpacing: 0.5 },
    typeRule: { color: colors.primary },
    typeProposed: { color: colors.textMuted },
    rowDate: { fontSize: 11 * fontScale, color: colors.textMuted },
    rowTitle: { fontSize: 15 * fontScale, fontWeight: "700", color: colors.text, lineHeight: 20 * fontScale },
    rowAbstract: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 4, lineHeight: 17 * fontScale },
    footnote: { fontSize: 11 * fontScale, color: colors.textMuted, marginTop: spacing(2), lineHeight: 16 * fontScale },
  });
}

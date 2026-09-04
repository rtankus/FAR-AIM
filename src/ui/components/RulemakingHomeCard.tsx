import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { fetchRecentFaaRulemaking } from "../../rulemaking/api";
import { cachedFetchRulemaking } from "../../rulemaking/cache";
import type { RulemakingDocument } from "../../rulemaking/types";

const PREVIEW_COUNT = 3;

/**
 * Home screen teaser for recently published FAA rulemaking (final rules &
 * proposed rules), pulled from the Federal Register API. Refreshes at most
 * once a day (see src/rulemaking/cache.ts) and silently falls back to
 * whatever was last cached — or hides itself — if there's no connection and
 * nothing cached yet.
 */
export default function RulemakingHomeCard({ onPress }: { onPress: () => void }) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [docs, setDocs] = useState<RulemakingDocument[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    cachedFetchRulemaking(userDb, PREVIEW_COUNT, () => fetchRecentFaaRulemaking(PREVIEW_COUNT))
      .then((res) => {
        if (!cancelled) setDocs(res.data.slice(0, PREVIEW_COUNT));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userDb]);

  if (failed && !docs) return null; // offline with nothing cached yet — nothing useful to show

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Rulemaking</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      {loading && !docs ? (
        <ActivityIndicator style={{ marginTop: spacing(1) }} color={colors.primary} />
      ) : (
        docs?.map((doc) => (
          <Text key={doc.documentNumber} style={styles.item} numberOfLines={1}>
            {doc.title}
          </Text>
        ))
      )}
      <Text style={styles.footnote}>FAA rules & proposed rules from the Federal Register · needs internet</Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: spacing(2),
      marginBottom: spacing(2),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { fontSize: 15 * fontScale, fontWeight: "700", color: colors.text },
    chevron: { fontSize: 18 * fontScale, color: colors.textMuted },
    item: { fontSize: 13 * fontScale, color: colors.text, marginTop: spacing(1) },
    footnote: { fontSize: 10.5 * fontScale, color: colors.textMuted, marginTop: spacing(1.5) },
  });
}

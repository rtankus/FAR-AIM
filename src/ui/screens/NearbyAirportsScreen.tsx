import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAirportsDb } from "../AirportsDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { NEARBY_AIRPORT_RADII_NM, useNearbyAirports, type NearbyAirportRadius } from "../hooks/useNearbyAirports";
import AirportsDataFreshness from "../components/AirportsDataFreshness";

type Props = NativeStackScreenProps<RootStackParamList, "NearbyAirports">;

export default function NearbyAirportsScreen({ navigation }: Props) {
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const airportsDb = useAirportsDb();
  const [radius, setRadius] = useState<NearbyAirportRadius>(25);
  const { rows, loading, error, refresh } = useNearbyAirports(airportsDb, radius);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.radiusRow}>
          {NEARBY_AIRPORT_RADII_NM.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRadius(r)}
              style={[styles.radiusChip, r === radius && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.radiusChipText, r === radius && { color: "#fff" }]}>{r} nm</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {!airportsDb ? <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && rows.length === 0 ? <ActivityIndicator style={{ marginTop: spacing(2) }} color={colors.primary} /> : null}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.airport.ident}
        refreshing={loading}
        onRefresh={refresh}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading && !error && airportsDb ? (
            <Text style={styles.empty}>No airports within {radius} nm.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("AirportDetail", { ident: item.airport.ident })}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.airport.ident}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.airport.name}
              </Text>
              <Text style={styles.meta}>
                {[item.airport.city, item.airport.state].filter(Boolean).join(", ")} · {Math.round(item.dist)} nm
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />

      <AirportsDataFreshness style={styles.footnote} />
      <Text style={styles.footnote}>
        Bundled on-device — no connection needed. Not for navigation.
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing(2.5), paddingTop: spacing(2) },
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
    badge: {
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: spacing(1.25),
      backgroundColor: colors.primary,
    },
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

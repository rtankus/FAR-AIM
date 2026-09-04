import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { ensureSeedProfiles, listProfiles } from "../../performance/store";
import type { AircraftProfile } from "../../performance/types";

type Props = NativeStackScreenProps<RootStackParamList, "Performance">;

export default function PerformanceScreen({ navigation }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);

  const load = useCallback(async () => {
    await ensureSeedProfiles(userDb);
    setProfiles(await listProfiles(userDb));
  }, [userDb]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.navigate("QuickCalculators")} style={styles.navRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.navRowLabel}>Quick calculators</Text>
          <Text style={styles.navRowHint}>Density altitude, pressure altitude, maneuvering speed</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Aircraft</Text>
        <Pressable onPress={() => navigation.navigate("AircraftProfileForm", undefined)}>
          <Text style={styles.addLink}>+ Add aircraft</Text>
        </Pressable>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No aircraft set up yet. Add one to run weight & balance and takeoff/landing performance.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("WeightAndBalance", { profileId: item.id })}
            onLongPress={() => navigation.navigate("AircraftProfileForm", { id: item.id })}
            style={({ pressed }) => [styles.profileRow, pressed && { opacity: 0.8 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{item.name}</Text>
              <Text style={styles.profileHint}>
                Max gross {item.maxGrossWeight} {item.weightUnit} · Va {item.vaAtMaxGross} kt
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />

      <Text style={styles.footnote}>
        Tap an aircraft to run weight & balance for a flight. Press and hold to edit its saved numbers.
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.75),
      margin: spacing(2.5),
      marginBottom: spacing(1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    navRowLabel: { fontSize: 15 * fontScale, fontWeight: "700", color: colors.text },
    navRowHint: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 2 },
    chevron: { fontSize: 22 * fontScale, color: colors.textMuted, marginLeft: spacing(1) },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing(2.5),
      marginTop: spacing(1),
      marginBottom: spacing(1),
    },
    sectionTitle: { fontSize: 13 * fontScale, fontWeight: "700", color: colors.textMuted },
    addLink: { fontSize: 13 * fontScale, fontWeight: "700", color: colors.primary },
    listContent: { paddingHorizontal: spacing(2.5), paddingBottom: spacing(2) },
    empty: { color: colors.textMuted, fontSize: 14 * fontScale, textAlign: "center", marginTop: spacing(4) },
    profileRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: spacing(1.75),
      marginBottom: spacing(1),
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    profileName: { fontSize: 16 * fontScale, fontWeight: "700", color: colors.text },
    profileHint: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: 2 },
    footnote: {
      fontSize: 11 * fontScale,
      color: colors.textMuted,
      paddingHorizontal: spacing(2.5),
      paddingBottom: spacing(2),
      lineHeight: 16 * fontScale,
    },
  });
}

import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { RootStackParamList, TabParamList } from "../navigation/types";
import { SectionListItem } from "../components/SectionListItem";
import { PreflightBriefingPanel } from "../components/PreflightBriefingPanel";
import { useDailyPicks } from "../hooks/useDailyPicks";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const { farPick, acPick } = useDailyPicks(db);
  // PreflightBriefingPanel owns its own weather/TFR fetch state internally;
  // remounting it (via this key) is the simplest way to give this screen's
  // pull-to-refresh a real effect without lifting that state up here.
  const [briefingKey, setBriefingKey] = useState(0);

  const openSection = useCallback((id: string) => navigation.navigate("Detail", { id }), [navigation]);

  // Preflight Briefing's "full detail" links point at screens that live in
  // the Weather tab's own stack, not this one — getParent() reaches the tab
  // navigator so those links can jump tabs directly instead of just naming
  // the Weather tab and leaving the user to find the right screen there.
  const tabNavigation = navigation.getParent<BottomTabNavigationProp<TabParamList>>();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => setBriefingKey((k) => k + 1)} />}
    >
      <PreflightBriefingPanel
        key={briefingKey}
        scrollable={false}
        onOpenWeather={() => tabNavigation?.navigate("WeatherTab", { screen: "Weather" })}
        onOpenTfr={() => tabNavigation?.navigate("WeatherTab", { screen: "Tfr" })}
        onOpenGfa={() => tabNavigation?.navigate("WeatherTab", { screen: "GfaMap" })}
        onOpenNotams={() => tabNavigation?.navigate("WeatherTab", { screen: "Notams" })}
      />
      {farPick || acPick ? (
        <>
          <Text style={styles.dailyTitle}>Today's Reading</Text>
          {farPick ? <SectionListItem section={farPick} onPress={() => openSection(farPick.id)} /> : null}
          {acPick ? <SectionListItem section={acPick} onPress={() => openSection(acPick.id)} /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    dailyTitle: {
      fontSize: 13 * fontScale,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: spacing(2.5),
      marginTop: spacing(1),
      marginBottom: spacing(0.5),
    },
  });
}

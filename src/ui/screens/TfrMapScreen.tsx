import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { useLocation } from "../hooks/useLocation";
import { fetchActiveTfrs } from "../../tfr/api";
import { staleWhileRevalidateTfrs } from "../../tfr/cache";
import { buildTfrMapHtml } from "../../tfr/mapHtml";
import { timeAgo } from "../../weather/format";
import type { Tfr } from "../../tfr/types";

type Props = NativeStackScreenProps<RootStackParamList, "TfrMap">;

export default function TfrMapScreen({ route }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const { coords: deviceCoords, locate } = useLocation();
  const [tfrs, setTfrs] = useState<Tfr[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await staleWhileRevalidateTfrs(userDb, fetchActiveTfrs, (fresh) => {
        setTfrs(fresh.data);
        setFetchedAt(fresh.fetchedAt);
        setStale(fresh.stale);
        setOffline(fresh.offline);
      });
      setTfrs(res.data);
      setFetchedAt(res.fetchedAt);
      setStale(res.stale);
      setOffline(res.offline);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [userDb]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Best-effort: shows the "you are here" dot when granted, silently omits
  // it otherwise — this screen never blocks on location the way Nearby
  // Weather does, since the map is still fully useful without it.
  useEffect(() => {
    locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const html = useMemo(() => {
    if (!tfrs) return null;
    return buildTfrMapHtml({
      tfrs,
      focusId: route.params?.focusId,
      center: route.params?.center,
      radiusNm: route.params?.radiusNm,
      deviceCoords,
      colors,
    });
  }, [tfrs, route.params?.focusId, route.params?.center, route.params?.radiusNm, deviceCoords, colors]);

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : html ? (
        <WebView
          key={html.length /* rebuild the WebView when the data actually changes */}
          originWhitelist={["*"]}
          source={{ html }}
          style={styles.webview}
          // Leaflet pans/zooms the map itself via its own touch handling
          // (CSS transforms), not native scrolling — leaving the WebView's
          // own outer scroll/bounce enabled just fights it and drags the
          // surrounding screen along with a pan/pinch gesture.
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
        />
      ) : null}

      {loading && !tfrs ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}

      {fetchedAt != null ? (
        <View style={[styles.footer, offline && { backgroundColor: colors.aimBadge }]}>
          <Text style={styles.footerText}>
            {offline ? "Offline — showing last known TFRs from " : stale ? "Refreshing… showing TFRs from " : "Updated "}
            {timeAgo(fetchedAt)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    webview: { flex: 1, backgroundColor: colors.background },
    loadingOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(3) },
    errorText: { color: colors.textMuted, fontSize: 14 * fontScale, textAlign: "center" },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      paddingVertical: spacing(0.75),
      alignItems: "center",
    },
    footerText: { fontSize: 11 * fontScale, color: colors.text, fontWeight: "600" },
  });
}

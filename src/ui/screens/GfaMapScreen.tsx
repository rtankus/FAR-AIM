import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";
import { GFA_URL } from "../../weather/gfa";

// It needs a live connection — there's no offline cache for a map like
// there is for METAR/TAF text.

export default function GfaMapScreen() {
  const { colors, spacing, fontScale } = useTheme();
  const styles = makeStyles(colors, spacing, fontScale);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.container}>
      {failed ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            Couldn't load the GFA map. It needs a live internet connection — check again once you have signal.
          </Text>
        </View>
      ) : (
        <WebView
          source={{ uri: GFA_URL }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setFailed(true)}
        />
      )}
      {loading && !failed ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading GFA map…</Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    webview: { flex: 1, backgroundColor: colors.background },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    loadingText: { marginTop: spacing(1.5), color: colors.textMuted, fontSize: 13 * fontScale },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing(3) },
    errorText: { color: colors.textMuted, fontSize: 14 * fontScale, textAlign: "center" },
  });
}

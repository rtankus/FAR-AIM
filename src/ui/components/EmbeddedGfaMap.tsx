import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../ThemeContext";
import { GFA_URL } from "../../weather/gfa";

/** A fixed-height inline preview of the live GFA map, for embedding in a scrolling screen (e.g. Home). */
export function EmbeddedGfaMap({ height = 460 }: { height?: number }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  return (
    <View style={[styles.frame, { height, borderColor: colors.border, backgroundColor: colors.surface }]}>
      <WebView
        source={{ uri: GFA_URL }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
      />
      {loading ? (
        <View style={[styles.loading, { backgroundColor: colors.surface }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  webview: { flex: 1 },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});

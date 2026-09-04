import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "../ThemeContext";
import type { Coords } from "../hooks/useLocation";
import { buildTfrMapHtml } from "../../tfr/mapHtml";
import type { Tfr } from "../../tfr/types";

/** A fixed-height inline preview of nearby TFRs on the map, for embedding in a scrolling screen (e.g. Home). */
export function EmbeddedTfrMap({
  tfrs,
  center,
  radiusNm,
  deviceCoords,
  height = 340,
}: {
  tfrs: Tfr[];
  center: { lat: number; lon: number; label: string } | undefined;
  radiusNm: number | undefined;
  deviceCoords: Coords | null;
  height?: number;
}) {
  const { colors } = useTheme();
  const html = useMemo(
    () => buildTfrMapHtml({ tfrs, focusId: undefined, center, radiusNm, deviceCoords, colors }),
    [tfrs, center, radiusNm, deviceCoords, colors]
  );

  return (
    <View style={[styles.frame, { height, borderColor: colors.border, backgroundColor: colors.surface }]}>
      <WebView
        key={html.length /* rebuild when the underlying data actually changes */}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.webview}
        // This sits inside a scrolling Home screen — without disabling the
        // WebView's own scroll/bounce, panning the map fights the outer
        // ScrollView's gesture recognizer and drags the whole screen with it.
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  webview: { flex: 1 },
});

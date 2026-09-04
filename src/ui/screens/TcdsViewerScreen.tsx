import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Paths } from "expo-file-system";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { getTcdsDocument, type TcdsDocument } from "../../db/userdb";
import { resolveTcdsFile } from "../../db/tcdsFiles";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "TcdsViewer">;

export default function TcdsViewerScreen({ route, navigation }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);
  const [doc, setDoc] = useState<TcdsDocument | null | undefined>(undefined);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTcdsDocument(userDb, route.params.id).then(setDoc);
  }, [userDb, route.params.id]);

  useLayoutEffect(() => {
    if (doc) navigation.setOptions({ title: doc.label });
  }, [navigation, doc]);

  useEffect(() => {
    if (!doc) return;
    const file = resolveTcdsFile(doc.file_path);
    if (!file.exists) {
      setError("The file is missing on disk. Delete this entry and save the TCDS again.");
      return;
    }
    setFileUri(file.uri);
  }, [doc]);

  if (doc === undefined || (doc && !fileUri && !error)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (doc === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>This TCDS couldn't be found — it may have been deleted.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: fileUri! }}
      style={styles.webview}
      originWhitelist={["*"]}
      // WKWebView (iOS) only loads a local file:// URL via the sandboxed
      // loadFileURL:allowingReadAccessToURL: API — this prop is what tells
      // react-native-webview's native side to use that path instead of a
      // plain (and, for local files, rejected) loadRequest:.
      allowingReadAccessToURL={Paths.document.uri}
      allowFileAccess
    />
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    webview: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: spacing(3) },
    errorText: { color: colors.textMuted, fontSize: 14 * fontScale, textAlign: "center" },
  });
}

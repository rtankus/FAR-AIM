import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { File } from "expo-file-system";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent, ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { addTcdsDocument } from "../../db/userdb";
import { newTcdsDestination } from "../../db/tcdsFiles";
import { useUserDb } from "../UserDbContext";
import { useTheme } from "../ThemeContext";
import type { ThemeColors } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "TcdsCapture">;

type Phase = "input" | "webview" | "saving" | "error";

// Injected into the page before it loads. Most "download PDF" buttons either
// (a) navigate to the PDF's URL directly — caught on the RN side via
// onShouldStartLoadWithRequest — or (b) fetch/XHR the PDF bytes in place
// (e.g. to feed an embedded viewer, as FAA's DRS site does) and hand them to
// the page's own JS, which never shows up as a navigation at all. This
// monkey-patches fetch/XHR to catch the latter, and forces window.open() into
// a same-webview navigation so case (a) still catches it too.
const INJECTED_JS = `
(function() {
  function toBase64(buf) {
    var bytes = new Uint8Array(buf);
    var chunk = 0x8000;
    var binary = '';
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }
  function post(msg) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
  }
  var captured = false;
  function tryCapture(buf, url) {
    if (captured || !buf || buf.byteLength < 100) return;
    var head = new Uint8Array(buf.slice(0, 5));
    var sig = '';
    for (var i = 0; i < head.length; i++) sig += String.fromCharCode(head[i]);
    if (sig !== '%PDF-') return;
    captured = true;
    post({ type: 'pdf-captured', base64: toBase64(buf), sourceUrl: url, pageTitle: document.title });
  }

  var origFetch = window.fetch && window.fetch.bind(window);
  if (origFetch) {
    window.fetch = function() {
      var args = arguments;
      return origFetch.apply(null, args).then(function(res) {
        try {
          var ct = (res.headers.get('content-type') || '').toLowerCase();
          if (res.status === 200 && ct.indexOf('pdf') !== -1) {
            res.clone().arrayBuffer().then(function(buf) { tryCapture(buf, res.url); });
          }
        } catch (e) {}
        return res;
      });
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__capturedUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    var xhr = this;
    xhr.addEventListener('load', function() {
      try {
        var ct = (xhr.getResponseHeader('content-type') || '').toLowerCase();
        if (xhr.status === 200 && ct.indexOf('pdf') !== -1) {
          var url = xhr.responseURL || xhr.__capturedUrl;
          fetch(url).then(function(r) { return r.arrayBuffer(); }).then(function(buf) { tryCapture(buf, url); });
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };

  window.open = function(url) {
    if (url) window.location.href = url;
    return null;
  };
  true;
})();
`;

function isDirectPdfUrl(url: string): boolean {
  return url.split("?")[0].split("#")[0].toLowerCase().endsWith(".pdf");
}

export default function TcdsCaptureScreen({ navigation, route }: Props) {
  const userDb = useUserDb();
  const { colors, spacing, fontScale } = useTheme();
  const styles = useMemo(() => makeStyles(colors, spacing, fontScale), [colors, spacing, fontScale]);

  const searchStartUrl = route.params?.startUrl;
  const isSearchMode = !!searchStartUrl;

  useLayoutEffect(() => {
    navigation.setOptions({ title: isSearchMode ? "Search for TCDS" : "Add TCDS" });
  }, [navigation, isSearchMode]);

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [error, setError] = useState<string | null>(null);
  // The URL the webview is actually pointed at — the typed-in one normally,
  // or the DRS search landing page in search mode.
  const [webviewUrl, setWebviewUrl] = useState("");

  const saveBytes = useCallback(
    async (opts: { base64?: string; downloadUrl?: string; sourceUrl: string; pageTitle?: string }) => {
      setPhase("saving");
      try {
        const { file: dest, relativePath } = newTcdsDestination();
        let file: File;
        if (opts.downloadUrl) {
          file = await File.downloadFileAsync(opts.downloadUrl, dest, { idempotent: true });
        } else {
          file = dest;
          file.write(opts.base64!, { encoding: "base64" });
        }
        if (file.size < 100) throw new Error("The saved file is empty — that link may not be a PDF.");

        await addTcdsDocument(userDb, {
          label: label.trim() || opts.pageTitle?.trim() || "Untitled TCDS",
          sourceUrl: opts.sourceUrl,
          filePath: relativePath,
          fileSize: file.size,
        });
        Alert.alert("Saved", "The TCDS is now available offline.");
        navigation.navigate("Tcds");
      } catch (err) {
        setPhase("error");
        setError(String(err instanceof Error ? err.message : err));
      }
    },
    [label, userDb, navigation]
  );

  const handleContinue = useCallback(() => {
    if (isSearchMode) {
      setWebviewUrl(searchStartUrl!);
      setError(null);
      setPhase("webview");
      return;
    }
    const trimmed = url.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      Alert.alert("Enter a URL", "Paste a full link, starting with http:// or https://.");
      return;
    }
    if (isDirectPdfUrl(trimmed)) {
      saveBytes({ downloadUrl: trimmed, sourceUrl: trimmed });
    } else {
      setWebviewUrl(trimmed);
      setError(null);
      setPhase("webview");
    }
  }, [isSearchMode, searchStartUrl, url, saveBytes]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === "pdf-captured" && typeof data.base64 === "string") {
          saveBytes({ base64: data.base64, sourceUrl: data.sourceUrl || webviewUrl, pageTitle: data.pageTitle });
        }
      } catch {
        // Not our message — ignore.
      }
    },
    [saveBytes, webviewUrl]
  );

  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => {
      if (isDirectPdfUrl(request.url) && request.url !== webviewUrl) {
        saveBytes({ downloadUrl: request.url, sourceUrl: request.url });
        return false;
      }
      return true;
    },
    [webviewUrl, saveBytes]
  );

  if (phase === "webview") {
    return (
      <View style={styles.container}>
        <View style={styles.webviewHeader}>
          <Text style={styles.webviewHint} numberOfLines={2}>
            {isSearchMode
              ? "Find your document, then tap its PDF or download link — it'll be saved automatically."
              : "Loading the page — tap its PDF or download link. It'll be saved automatically once found."}
          </Text>
          <Pressable onPress={() => setPhase("input")} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: webviewUrl }}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          onMessage={handleMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          style={styles.webview}
        />
      </View>
    );
  }

  if (phase === "saving") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.centeredText}>Saving PDF…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isSearchMode && (
        <>
          <Text style={styles.label}>TCDS URL</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://drs.faa.gov/browse/excelExternalWindow/…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
        </>
      )}

      <Text style={styles.label}>Label</Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Cessna 150 (all models)"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      {phase === "error" && error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={handleContinue}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.buttonText}>{isSearchMode ? "Browse DRS" : "Continue"}</Text>
      </Pressable>

      <Text style={styles.hint}>
        {isSearchMode
          ? "Optionally label it now — if left blank, the page title is used. The FAA's Dynamic Regulatory System opens next; search for your aircraft and tap its PDF/download link to save it."
          : "If the link is a direct PDF, it saves right away. Otherwise the page opens below so you can tap its download link — that PDF is captured and saved automatically."}
      </Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, spacing: (n: number) => number, fontScale: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: spacing(2.5) },
    label: { fontSize: 13 * fontScale, fontWeight: "600", color: colors.textMuted, marginBottom: 6, marginTop: spacing(2) },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      color: colors.text,
      fontSize: 15 * fontScale,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: spacing(1.5),
      alignItems: "center",
      marginTop: spacing(3),
    },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 * fontScale },
    hint: { fontSize: 12 * fontScale, color: colors.textMuted, marginTop: spacing(2), lineHeight: 17 * fontScale },
    error: { color: colors.danger, fontSize: 13 * fontScale, marginTop: spacing(2) },
    centered: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
    centeredText: { marginTop: spacing(1.5), color: colors.textMuted, fontSize: 14 * fontScale },
    webviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing(1.5),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    webviewHint: { flex: 1, fontSize: 12 * fontScale, color: colors.textMuted, marginRight: spacing(1.5) },
    cancelButton: { paddingHorizontal: spacing(1.5), paddingVertical: spacing(1) },
    cancelButtonText: { color: colors.primary, fontWeight: "700", fontSize: 14 * fontScale },
    webview: { flex: 1 },
  });
}

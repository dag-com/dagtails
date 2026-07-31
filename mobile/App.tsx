import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";

/** Live GitHub Pages build — works from any network. */
export const PAGES_URL =
  "https://dag-com.github.io/last-call-bartending-game/";

/**
 * Override at runtime with EXPO_PUBLIC_GAME_URL
 * (e.g. a Cloudflare Tunnel / ngrok URL pointing at local `npx serve -l 4173`).
 */
function resolveGameUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_GAME_URL || "").trim();
  return fromEnv || PAGES_URL;
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const [uri, setUri] = useState(resolveGameUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navTitle, setNavTitle] = useState("DAG Tails");

  const source = useMemo(() => ({ uri }), [uri]);

  const onNav = useCallback((nav: WebViewNavigation) => {
    if (nav.title) setNavTitle(nav.title);
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  const usePages = useCallback(() => {
    setError(null);
    setLoading(true);
    setUri(PAGES_URL);
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.chrome}>
        <Text style={styles.chromeTitle} numberOfLines={1}>
          {navTitle}
        </Text>
        <View style={styles.chromeActions}>
          <Pressable onPress={reload} style={styles.chip} hitSlop={8}>
            <Text style={styles.chipText}>Reload</Text>
          </Pressable>
          <Pressable onPress={usePages} style={styles.chip} hitSlop={8}>
            <Text style={styles.chipText}>Pages</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.webWrap}>
        {loading && !error ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator color="#e9b949" size="large" />
            <Text style={styles.overlayText}>Loading bar…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load the game</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorHint}>URI: {uri}</Text>
            <Pressable onPress={reload} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </Pressable>
            <Pressable onPress={usePages} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Open GitHub Pages</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={source}
            style={styles.web}
            onLoadStart={() => {
              setLoading(true);
              setError(null);
            }}
            onLoadEnd={() => setLoading(false)}
            onNavigationStateChange={onNav}
            onError={(e) => {
              setLoading(false);
              setError(e.nativeEvent.description || "WebView error");
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 400) {
                setLoading(false);
                setError(`HTTP ${e.nativeEvent.statusCode}`);
              }
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            // LAN http:// during local tunnel/dev
            originWhitelist={["*"]}
            mixedContentMode="always"
            // iOS: allow http for local tunnels
            {...(Platform.OS === "ios"
              ? { allowsBackForwardNavigationGestures: true }
              : {})}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0c0814",
  },
  chrome: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#120b1f",
    gap: 8,
  },
  chromeTitle: {
    flex: 1,
    color: "#fff7e6",
    fontWeight: "700",
    fontSize: 13,
  },
  chromeActions: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(233,185,73,0.45)",
    backgroundColor: "rgba(233,185,73,0.12)",
  },
  chipText: {
    color: "#e9b949",
    fontSize: 12,
    fontWeight: "800",
  },
  webWrap: {
    flex: 1,
    position: "relative",
  },
  web: {
    flex: 1,
    backgroundColor: "#0c0814",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12,8,20,0.72)",
    gap: 10,
  },
  overlayText: {
    color: "#b3a4cf",
    fontWeight: "600",
  },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  errorTitle: {
    color: "#fff7e6",
    fontSize: 18,
    fontWeight: "800",
  },
  errorBody: {
    color: "#ff6b6b",
    textAlign: "center",
  },
  errorHint: {
    color: "#b3a4cf",
    fontSize: 12,
    textAlign: "center",
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: "#e9b949",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: "#1a1008",
    fontWeight: "800",
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: "#e9b949",
    fontWeight: "700",
  },
});

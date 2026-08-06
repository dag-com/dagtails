import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";

/** Live GitHub Pages build — always on, works from any network (no laptop). */
export const PAGES_URL =
  "https://dag-com.github.io/last-call-bartending-game/";

/**
 * Override at runtime with EXPO_PUBLIC_GAME_URL
 * (e.g. a Cloudflare Tunnel pointing at local `npm run serve:www`).
 * Remote testers should use Pages — not a local tunnel.
 */
function resolveGameUrl(): string {
  const fromEnv = (process.env.EXPO_PUBLIC_GAME_URL || "").trim();
  return fromEnv || PAGES_URL;
}

/** Bust WebView HTTP cache so phones pick up the latest Pages deploy. */
function withCacheBust(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("v", String(Date.now()));
    return u.href;
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${Date.now()}`;
  }
}

function friendlyLoadError(raw: string, statusCode?: number): string {
  if (statusCode && statusCode >= 500) {
    return `GitHub Pages returned HTTP ${statusCode}. The always-on host may be redeploying — retry in a minute.`;
  }
  if (statusCode && statusCode >= 400) {
    return `GitHub Pages returned HTTP ${statusCode}. Try Reload, or open the Pages link in your phone browser.`;
  }
  const s = (raw || "").toLowerCase();
  if (
    /net::|network|offline|internet|timed?\s*out|could not connect|dns|unreachable|failed to connect/.test(
      s
    )
  ) {
    return "Network error — check your connection. The game is always on at GitHub Pages (no Expo tunnel required).";
  }
  return raw || "Could not load the game from GitHub Pages.";
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const [uri, setUri] = useState(() => withCacheBust(resolveGameUrl()));
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
    // Prefer a fresh URI over WebView.reload() so cache-bust applies.
    setUri((prev) => {
      try {
        const base = new URL(prev);
        base.searchParams.delete("v");
        return withCacheBust(base.href);
      } catch {
        return withCacheBust(resolveGameUrl());
      }
    });
  }, []);

  const usePages = useCallback(() => {
    setError(null);
    setLoading(true);
    setUri(withCacheBust(PAGES_URL));
  }, []);

  const openPagesInBrowser = useCallback(() => {
    Linking.openURL(PAGES_URL).catch(() => {
      setError("Could not open the system browser. Copy the Pages URL from mobile/README.md.");
    });
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
            <Text style={styles.errorHint}>
              Always-on URL:{"\n"}
              {PAGES_URL}
            </Text>
            <Text style={styles.errorHintMuted} numberOfLines={2}>
              Last tried: {uri}
            </Text>
            <Pressable onPress={reload} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Retry</Text>
            </Pressable>
            <Pressable onPress={usePages} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Load GitHub Pages</Text>
            </Pressable>
            <Pressable onPress={openPagesInBrowser} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Open in phone browser</Text>
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
              setError(
                friendlyLoadError(e.nativeEvent.description || "WebView error")
              );
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 400) {
                setLoading(false);
                setError(
                  friendlyLoadError(
                    `HTTP ${e.nativeEvent.statusCode}`,
                    e.nativeEvent.statusCode
                  )
                );
              }
            }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            // LAN http:// during local shell-dev only
            originWhitelist={["*"]}
            mixedContentMode="always"
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
    ...StyleSheet.absoluteFillObject,
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
    color: "#e9b949",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  errorHintMuted: {
    color: "#b3a4cf",
    fontSize: 11,
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

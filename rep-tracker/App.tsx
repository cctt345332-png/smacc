/**
 * Rep Tracker App
 * WebView + Background Location Tracking
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View, StyleSheet, ActivityIndicator,
  Text, AppState, Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import {
  saveCredentials,
  startBackgroundTracking,
  isTrackingActive,
  requestAllPermissions,
} from "./src/locationService";
import { TOKEN_KEY } from "./src/locationTask";

const APP_URL        = "https://www.masa-erp.com/ar/login";
const DASHBOARD_URL  = "https://www.masa-erp.com/ar/reps/me/dashboard";
const SUPERVISOR_URL = "https://www.masa-erp.com/ar/supervisor/dashboard";
const API_URL        = "https://api.masa-erp.com";

/** decode JWT payload بدون atob — غير متوفرة في RN native layer */
function decodeJwtRole(token: string): string {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded  = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const chars   = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let str = "";
    let i   = 0;
    while (i < padded.length) {
      const c1 = chars.indexOf(padded[i++]);
      const c2 = chars.indexOf(padded[i++]);
      const c3 = chars.indexOf(padded[i++]);
      const c4 = chars.indexOf(padded[i++]);
      str += String.fromCharCode((c1 << 2) | (c2 >> 4));
      if (c3 !== 64) str += String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2));
      if (c4 !== 64) str += String.fromCharCode(((c3 & 3) << 6) | c4);
    }
    return JSON.parse(str)?.role ?? "sales_rep";
  } catch {
    return "sales_rep";
  }
}

export default function App() {
  const webRef   = useRef<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [tracking, setTracking] = useState(false);
  const [token,    setToken]    = useState<string | null>(null);
  const [webUrl,   setWebUrl]   = useState(APP_URL);
  const appState = useRef(AppState.currentState);

  /* ── إقلاع ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const init = async () => {
      await requestAllPermissions();
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          const role = decodeJwtRole(saved);
          setToken(saved);
          setWebUrl(role === "supervisor" ? SUPERVISOR_URL : DASHBOARD_URL);
          const started = await startBackgroundTracking();
          setTracking(started);
        }
      } catch {}
    };
    init();
    isTrackingActive().then(setTracking).catch(() => {});
  }, []);

  /* ── رصد حالة التطبيق ──────────────────────────────────────────── */
  useEffect(() => {
    const sub = AppState.addEventListener("change", nextState => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        extractToken();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  /* ── استخراج الـ token من WebView ──────────────────────────────── */
  const extractToken = useCallback(() => {
    webRef.current?.injectJavaScript(`
      (function() {
        try {
          const raw = localStorage.getItem('erp-auth');
          if (raw) {
            const d = JSON.parse(raw);
            const t = d?.state?.token || null;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: t }));
          }
        } catch(e) {}
      })();
      true;
    `);
  }, []);

  /* ── معالجة الرسائل من WebView ─────────────────────────────────── */
  const onMessage = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "token" && msg.token && msg.token !== token) {
        setToken(msg.token);
        await saveCredentials(msg.token, API_URL);
        const role = decodeJwtRole(msg.token);
        if (role === "supervisor") setWebUrl(SUPERVISOR_URL);
        const started = await startBackgroundTracking();
        setTracking(started);
      }
    } catch {}
  }, [token]);

  const onLoadEnd = useCallback(() => {
    setLoading(false);
    setTimeout(extractToken, 1500);
  }, [extractToken]);

  /* ── JS يُحقن في WebView ────────────────────────────────────────── */
  const INJECT_JS = `
    (function() {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        orig.apply(this, arguments);
        if (key === 'erp-auth') {
          try {
            const d = JSON.parse(value);
            const t = d?.state?.token || null;
            if (t) window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: t }));
          } catch(e) {}
        }
      };
      const origRemove = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function(key) {
        if (key === 'erp-auth') return;
        origRemove.apply(this, arguments);
      };
      const hideLogout = () => {
        document.querySelectorAll('button, a, [role="button"]').forEach(el => {
          const text = el.textContent?.trim();
          if (text === 'تسجيل الخروج' || text === 'Logout') el.style.display = 'none';
        });
      };
      new MutationObserver(hideLogout).observe(document.documentElement, { childList: true, subtree: true });
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#1E40AF" />

      <View style={styles.topBar}>
        <Text style={styles.title}>نظام المناديب</Text>
        <View style={styles.badge}>
          <View style={[styles.dot, { backgroundColor: tracking ? "#4ADE80" : "#94A3B8" }]} />
          <Text style={styles.badgeText}>{tracking ? "نشط" : "..."}</Text>
        </View>
      </View>

      <WebView
        ref={webRef}
        source={{ uri: webUrl }}
        style={styles.webview}
        onLoadEnd={onLoadEnd}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={INJECT_JS}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        geolocationEnabled={false}
        onError={e => console.log("WebView error:", e.nativeEvent)}
      />

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loaderText}>جاري التحميل...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1E40AF" },
  topBar: {
    backgroundColor: "#1E40AF",
    paddingTop: Platform.OS === "ios" ? 50 : 36,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title:     { color: "white", fontWeight: "bold", fontSize: 16 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: "white", fontSize: 12, fontWeight: "600" },
  webview:   { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loaderText: { color: "#6B7280", fontSize: 14 },
});

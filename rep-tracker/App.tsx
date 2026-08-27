/**
 * Rep Tracker App
 * WebView + Background Location Tracking + محفوظات جلسة آمنة
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View, StyleSheet,
  Text, AppState, Platform, Pressable, Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import {
  saveCredentials,
  clearCredentials,
  startBackgroundTracking,
  stopBackgroundTracking,
  requestAllPermissions,
} from "./src/locationService";
import { TOKEN_KEY } from "./src/locationTask";

const APP_URL = "https://www.masa-erp.com/ar/login";
const REP_DASHBOARD_URL = "https://www.masa-erp.com/ar/reps/me/dashboard";
const SUPERVISOR_URL = "https://www.masa-erp.com/ar/supervisor/dashboard";
const ADMIN_DASHBOARD_URL = "https://www.masa-erp.com/ar/dashboard";
const SUPER_ADMIN_URL = "https://www.masa-erp.com/ar/super-admin/dashboard";
const API_URL = "https://api.masa-erp.com";

/** decode JWT payload بدون atob — غير متوفرة في RN native layer */
function decodeJwtRole(token: string): string {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let str = "";
    let i = 0;
    while (i < padded.length) {
      const c1 = chars.indexOf(padded[i++]);
      const c2 = chars.indexOf(padded[i++]);
      const c3 = chars.indexOf(padded[i++]);
      const c4 = chars.indexOf(padded[i++]);
      str += String.fromCharCode((c1 << 2) | (c2 >> 4));
      if (c3 !== 64) str += String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2));
      if (c4 !== 64) str += String.fromCharCode(((c3 & 3) << 6) | c4);
    }
    return JSON.parse(str)?.role ?? "user";
  } catch {
    return "user";
  }
}

function dashboardForRole(role: string): string {
  if (role === "sales_rep") return REP_DASHBOARD_URL;
  if (role === "supervisor") return SUPERVISOR_URL;
  if (role === "super_admin") return SUPER_ADMIN_URL;
  return ADMIN_DASHBOARD_URL;
}

function tracksLocation(role: string): boolean {
  return role === "sales_rep" || role === "supervisor";
}

export default function App() {
  const webRef = useRef<any>(null);
  const [tracking, setTracking] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [webUrl, setWebUrl] = useState(APP_URL);
  const appState = useRef(AppState.currentState);

  /** يمسح الجلسة فقط عند تسجيل خروج أو تبديل حساب صريح. */
  const clearAccountSession = useCallback(async () => {
    await stopBackgroundTracking();
    await clearCredentials();
    setTracking(false);
    setToken(null);
    setWebUrl(APP_URL);
  }, []);

  /* ── إقلاع ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const init = async () => {
      await requestAllPermissions();
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!saved) {
          await stopBackgroundTracking();
          setTracking(false);
          return;
        }

        const role = decodeJwtRole(saved);
        setToken(saved);
        setWebUrl(dashboardForRole(role));

        if (tracksLocation(role)) {
          setTracking(await startBackgroundTracking());
        } else {
          await stopBackgroundTracking();
          setTracking(false);
        }
      } catch {
        setTracking(false);
      }
    };

    void init();
  }, []);

  /* ── استخراج آخر توكن فعلي من WebView ──────────────────────────── */
  const extractToken = useCallback(() => {
    webRef.current?.injectJavaScript(`
      (function() {
        try {
          const raw = localStorage.getItem('erp-auth');
          const data = raw ? JSON.parse(raw) : null;
          const token = data?.state?.token || null;
          // عدم وجود توكن في صفحة الدخول طبيعي، وليس تسجيل خروج.
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: token }));
        } catch(e) {}
      })();
      true;
    `);
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
  }, [extractToken]);

  /* ── معالجة الرسائل من WebView ─────────────────────────────────── */
  const onMessage = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      // تسجيل الخروج يُعالج فقط إن كانت هناك جلسة محفوظة أصلًا.
      // صفحة الدخول بدون توكن لا يجب أن تعيد تشغيل الصفحة.
      if (msg.type === "logout") {
        if (token) await clearAccountSession();
        return;
      }

      if (msg.type !== "token" || !msg.token || msg.token === token) return;

      const role = decodeJwtRole(msg.token);
      setToken(msg.token);
      await saveCredentials(msg.token, API_URL);
      setWebUrl(dashboardForRole(role));

      if (tracksLocation(role)) {
        setTracking(await startBackgroundTracking());
      } else {
        await stopBackgroundTracking();
        setTracking(false);
      }
    } catch {}
  }, [clearAccountSession, token]);

  const onLoadEnd = useCallback(() => {
    // لا نعرض طبقة تحميل Native؛ صفحة الويب تتحكم في تحميلها وتنقلها بنفسها.
    setTimeout(extractToken, 500);
  }, [extractToken]);

  /** تبديل حساب من التطبيق: يسمح لمسح جلسة الموقع ثم يعيد صفحة الدخول. */
  const switchAccount = useCallback(() => {
    Alert.alert(
      "تبديل الحساب",
      "سيتم إيقاف تتبع الحساب الحالي وتسجيل الدخول بحساب آخر.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "تبديل الحساب",
          style: "destructive",
          onPress: () => {
            webRef.current?.injectJavaScript(`
              (function() {
                try {
                  localStorage.removeItem('erp-auth');
                  sessionStorage.removeItem('erp-auth');
                } catch(e) {}
              })();
              true;
            `);
            void clearAccountSession();
          },
        },
      ],
    );
  }, [clearAccountSession]);

  /* ── JS يُحقن في WebView ────────────────────────────────────────── */
  const SESSION_BRIDGE_JS = `
    (function() {
      if (window.__MASAR_SESSION_BRIDGE__) return true;
      window.__MASAR_SESSION_BRIDGE__ = true;

      const notify = function(value) {
        try {
          const data = value ? JSON.parse(value) : null;
          const token = data?.state?.token || null;
          // لا نرسل logout عند عدم وجود توكن؛ صفحة الدخول حالة طبيعية.
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: token }));
        } catch(e) {}
      };

      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        if (key === 'erp-auth') notify(value);
      };

      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function(key) {
        originalRemoveItem.apply(this, arguments);
        if (key === 'erp-auth') {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'logout' }));
        }
      };
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#3E0865" />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>نظام المناديب</Text>
          <View style={styles.badge}>
            <View style={[styles.dot, { backgroundColor: tracking ? "#4ADE80" : "#CBD5E1" }]} />
            <Text style={styles.badgeText}>{tracking ? "التتبع نشط" : "التتبع متوقف"}</Text>
          </View>
        </View>

        {token && (
          <Pressable
            onPress={switchAccount}
            style={({ pressed }) => [styles.switchButton, pressed && styles.switchButtonPressed]}
          >
            <Text style={styles.switchButtonText}>تبديل الحساب</Text>
          </Pressable>
        )}
      </View>

      <WebView
        ref={webRef}
        source={{ uri: webUrl }}
        style={styles.webview}
        onLoadEnd={onLoadEnd}
        onMessage={onMessage}
        injectedJavaScriptBeforeContentLoaded={SESSION_BRIDGE_JS}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        geolocationEnabled={false}
        onError={e => console.log("WebView error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#3E0865" },
  topBar: {
    backgroundColor: "#3E0865",
    paddingTop: Platform.OS === "ios" ? 50 : 36,
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { color: "white", fontWeight: "bold", fontSize: 16 },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { color: "rgba(255,255,255,0.84)", fontSize: 11, fontWeight: "600" },
  switchButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)",
    borderRadius: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  switchButtonPressed: { opacity: 0.72 },
  switchButtonText: { color: "white", fontSize: 12, fontWeight: "700" },
  webview: { flex: 1 },
});

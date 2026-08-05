/**
 * الشاشة الرئيسية — WebView يفتح تطبيق الويب
 * يقرأ التوكن من localStorage ويبدأ تتبع الموقع في الخلفية
 */
import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View, StyleSheet, ActivityIndicator, Alert,
  AppState, Platform, Text, TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import {
  saveCredentials, clearCredentials,
  startBackgroundTracking, stopBackgroundTracking,
  isTrackingActive,
} from "../src/locationService";

// ─── عنوان التطبيق — غيّره للدومين الخاص بك ──────────────────────────
const APP_URL = "https://api.masa-erp.com";
const API_URL = "https://api.masa-erp.com";
// ─────────────────────────────────────────────────────────────────────

export default function MainScreen() {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);

  // ── قراءة التوكن من localStorage بعد تحميل الصفحة ──────────────────
  const extractToken = useCallback(() => {
    webRef.current?.injectJavaScript(`
      (function() {
        try {
          const raw = localStorage.getItem('erp-auth');
          if (raw) {
            const data = JSON.parse(raw);
            const t = data?.state?.token || null;
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: t }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: null }));
          }
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', msg: e.message }));
        }
      })();
      true;
    `);
  }, []);

  // ── معالجة الرسائل من WebView ────────────────────────────────────────
  const onMessage = useCallback(async (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "token") {
        if (msg.token && msg.token !== token) {
          setToken(msg.token);
          await saveCredentials(msg.token, API_URL);
          const started = await startBackgroundTracking();
          setTracking(started);
          console.log("[App] Token saved, tracking:", started);
        } else if (!msg.token && token) {
          // تسجيل خروج
          setToken(null);
          await clearCredentials();
          await stopBackgroundTracking();
          setTracking(false);
        }
      }
    } catch {}
  }, [token]);

  // ── فحص التوكن عند عودة التطبيق ─────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", nextState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        extractToken();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [extractToken]);

  // ── تحقق من حالة التتبع ──────────────────────────────────────────────
  useEffect(() => {
    isTrackingActive().then(setTracking);
  }, []);

  const onLoadEnd = useCallback(() => {
    setLoading(false);
    // انتظر قليلاً ثم استخرج التوكن
    setTimeout(extractToken, 1500);
  }, [extractToken]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="#1E40AF" />

      {/* شريط الحالة */}
      <View style={styles.statusBar}>
        <Text style={styles.statusTitle}>نظام المناديب</Text>
        <View style={styles.trackingBadge}>
          <View style={[styles.dot, { backgroundColor: tracking ? "#4ADE80" : "#94A3B8" }]} />
          <Text style={styles.trackingText}>
            {tracking ? "التتبع نشط" : "التتبع متوقف"}
          </Text>
        </View>
      </View>

      {/* WebView */}
      <WebView
        ref={webRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        onLoadEnd={onLoadEnd}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        geolocationEnabled={false}  // التطبيق يتولى الموقع بدلاً من المتصفح
        cacheEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        // inject script لمراقبة تغير localStorage
        injectedJavaScriptBeforeContentLoaded={`
          (function() {
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
              orig.apply(this, arguments);
              if (key === 'erp-auth') {
                try {
                  const data = JSON.parse(value);
                  const t = data?.state?.token || null;
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: t }));
                } catch(e) {}
              }
            };
            const origRemove = Storage.prototype.removeItem;
            Storage.prototype.removeItem = function(key) {
              origRemove.apply(this, arguments);
              if (key === 'erp-auth') {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token: null }));
              }
            };
          })();
          true;
        `}
        onError={e => console.log("[WebView] Error:", e.nativeEvent.description)}
      />

      {/* شاشة تحميل */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1E40AF" },
  statusBar: {
    backgroundColor: "#1E40AF",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 12,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTitle: { color: "white", fontWeight: "bold", fontSize: 15 },
  trackingBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trackingText: { color: "white", fontSize: 12, fontWeight: "600" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#6B7280", fontSize: 14 },
});

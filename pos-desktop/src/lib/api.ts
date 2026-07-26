/**
 * API Client — يتصل بالـ backend عبر serverUrl المحفوظ
 * يضيف Authorization header تلقائياً
 */
import axios from "axios";
import { usePOSStore } from "@/store/posStore";

const api = axios.create({
  timeout: 30000,
});

// Request interceptor — يضيف serverUrl و token
api.interceptors.request.use((config) => {
  let { serverUrl, token } = usePOSStore.getState();

  // fallback من localStorage إذا الـ store فارغ
  if (!serverUrl) {
    try {
      const raw = localStorage.getItem("masar-pos-config");
      if (raw) {
        const saved = JSON.parse(raw);
        serverUrl = saved.serverUrl || "";
        if (!token) token = saved.token || null;
      }
    } catch {}
  }

  // بناء الـ base URL
  const base = serverUrl.replace(/\/$/, "");
  if (base && !config.url?.startsWith("http")) {
    config.url = `${base}/api/v1${config.url}`;
  }

  // إضافة token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Response interceptor — معالجة انتهاء الجلسة
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // token منتهي — logout
      usePOSStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

export default api;

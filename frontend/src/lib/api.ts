import axios from "axios";
import { useAuthStore } from "@/store/authStore";

let authRedirecting = false;

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
});

// إرفاق الـ token مع كل طلب
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// معالجة 401 — تسجيل خروج تلقائي وتوجيه لصفحة الدخول
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined" && !authRedirecting) {
      const currentPath = window.location.pathname;
      if (!currentPath.endsWith("/login")) {
        authRedirecting = true;
        useAuthStore.getState().logout();
        // استخراج الـ locale من الـ URL الحالي
        const locale = currentPath.split("/")[1] || "ar";
        const validLocales = ["ar", "en"];
        const lang = validLocales.includes(locale) ? locale : "ar";
        window.location.replace(`/${lang}/login`);
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/**
 * locationTask.ts
 * مهمة تتبع الموقع في الخلفية — تعمل حتى عند إغلاق التطبيق
 * يرسل للـ endpoint الصحيح حسب دور المستخدم (مندوب / مشرف)
 */
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

export const LOCATION_TASK_NAME = "rep-background-location";
export const API_URL_KEY = "rep_api_url";
export const TOKEN_KEY = "rep_auth_token";
export const USER_ROLE_KEY = "rep_user_role";   // جديد — نخزن الدور

/** استخراج الدور من JWT — بدون atob (غير متوفرة في RN native layer) */
function getRoleFromToken(token: string): string {
  try {
    const base64 = token.split(".")[1];
    // React Native لا يدعم atob — نستخدم Buffer أو decode يدوي
    const base64Fixed = base64.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64Fixed.padEnd(
      base64Fixed.length + ((4 - (base64Fixed.length % 4)) % 4), "="
    );
    // decode base64 يدوياً بدون atob
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
    const payload = JSON.parse(str);
    return payload?.role ?? "sales_rep";
  } catch {
    return "sales_rep";
  }
}

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.log("[LocationTask] Error:", error.message);
    return;
  }

  if (!data?.locations?.length) return;

  try {
    const token  = await SecureStore.getItemAsync(TOKEN_KEY);
    const apiUrl = await SecureStore.getItemAsync(API_URL_KEY);

    if (!token || !apiUrl) {
      console.log("[LocationTask] No token or API URL");
      return;
    }

    // تحديد الـ endpoint حسب الدور
    const role = getRoleFromToken(token);
    const endpoint = role === "supervisor"
      ? `${apiUrl}/api/v1/supervisors/me/location`
      : `${apiUrl}/api/v1/reps/me/location`;

    const loc = data.locations[0];
    const payload = {
      latitude:   loc.coords.latitude,
      longitude:  loc.coords.longitude,
      accuracy:   loc.coords.accuracy  ?? null,
      speed:      loc.coords.speed     ?? null,
      heading:    loc.coords.heading   ?? null,
      is_moving:  (loc.coords.speed ?? 0) > 0.5,
      recorded_at: new Date(loc.timestamp).toISOString(),
    };

    await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    console.log(`[LocationTask] Sent (${role}):`, payload.latitude, payload.longitude);
  } catch (e: any) {
    console.log("[LocationTask] Send failed:", e.message);
  }
});

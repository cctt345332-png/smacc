/**
 * locationTask.ts
 * مهمة تتبع الموقع في الخلفية — تعمل حتى عند إغلاق التطبيق
 */
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

export const LOCATION_TASK_NAME = "rep-background-location";
export const API_URL_KEY = "rep_api_url";
export const TOKEN_KEY = "rep_auth_token";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.log("[LocationTask] Error:", error.message);
    return;
  }

  if (!data?.locations?.length) return;

  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const apiUrl = await SecureStore.getItemAsync(API_URL_KEY);

    if (!token || !apiUrl) {
      console.log("[LocationTask] No token or API URL");
      return;
    }

    const loc = data.locations[0];
    const payload = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
      heading: loc.coords.heading ?? null,
      is_moving: (loc.coords.speed ?? 0) > 0.5,
      recorded_at: new Date(loc.timestamp).toISOString(),
    };

    await axios.post(`${apiUrl}/api/v1/reps/me/location`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    console.log("[LocationTask] Sent:", payload.latitude, payload.longitude);
  } catch (e: any) {
    console.log("[LocationTask] Send failed:", e.message);
  }
});

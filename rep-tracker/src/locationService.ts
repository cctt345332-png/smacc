/**
 * locationService.ts
 * إدارة بدء/إيقاف تتبع الموقع في الخلفية
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import { LOCATION_TASK_NAME, TOKEN_KEY, API_URL_KEY } from "./locationTask";

export async function saveCredentials(token: string, apiUrl: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(API_URL_KEY, apiUrl);
}

export async function clearCredentials() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(API_URL_KEY);
}

export async function startBackgroundTracking(): Promise<boolean> {
  try {
    // طلب أذن الموقع الدائم
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      console.log("[LocationService] Foreground permission denied");
      return false;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== "granted") {
      console.log("[LocationService] Background permission denied — foreground only");
      // نكمل بالـ foreground فقط
    }

    // تحقق هل التتبع شغّال بالفعل
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
      .catch(() => false);

    if (!isRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 60_000,        // كل دقيقة
        distanceInterval: 50,         // أو كل 50 متر
        showsBackgroundLocationIndicator: true,  // iOS — يُظهر شريط الموقع
        foregroundService: {
          notificationTitle: "المندوب - تتبع نشط",
          notificationBody: "يتم تتبع موقعك أثناء العمل",
          notificationColor: "#2563EB",
          killServiceOnDestroy: false,  // يستمر حتى بعد إغلاق التطبيق
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        deferredUpdatesDistance: 0,
        deferredUpdatesTimeout: 0,
        // Android: استمر حتى بعد إغلاق التطبيق
        foregroundService: {
          notificationTitle: "المندوب — نشط",
          notificationBody: "يتم تتبع موقعك أثناء العمل",
          notificationColor: "#2563EB",
          killServiceOnDestroy: false,
        },
      });
      console.log("[LocationService] Background tracking started");
    }
    return true;
  } catch (e: any) {
    console.log("[LocationService] Start failed:", e.message);
    return false;
  }
}

export async function stopBackgroundTracking() {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
      .catch(() => false);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log("[LocationService] Background tracking stopped");
    }
  } catch (e: any) {
    console.log("[LocationService] Stop failed:", e.message);
  }
}

export async function isTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
}

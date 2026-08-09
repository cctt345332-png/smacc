/**
 * locationService.ts — تتبع قوي لا يتوقف
 * الحل متعدد الطبقات:
 * 1. Foreground Service مع killServiceOnDestroy=false
 * 2. timeInterval صغير + distanceInterval=0 لضمان الإرسال
 * 3. طلب إذن "تجاهل تحسين البطارية" من المستخدم
 * 4. طلب أذونات الكاميرا والصوت والإشعارات عند الإقلاع
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { Platform, Linking } from "react-native";
import { LOCATION_TASK_NAME, TOKEN_KEY, API_URL_KEY } from "./locationTask";

export async function saveCredentials(token: string, apiUrl: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(API_URL_KEY, apiUrl);
}

export async function clearCredentials() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(API_URL_KEY);
}

/** طلب جميع الأذونات عند الإقلاع */
export async function requestAllPermissions(): Promise<void> {
  // ── الكاميرا ──────────────────────────────────────────────────────
  try {
    const { Camera } = await import("expo-camera");
    await Camera.requestCameraPermissionsAsync();
  } catch {}

  // ── الميكروفون / الصوت ────────────────────────────────────────────
  try {
    const { Audio } = await import("expo-av");
    await Audio.requestPermissionsAsync();
  } catch {}

  // ── الإشعارات ─────────────────────────────────────────────────────
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  } catch {}
}

export async function startBackgroundTracking(): Promise<boolean> {
  try {
    // 1. أذن الموقع الأمامي
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") return false;

    // 2. أذن الموقع الدائم في الخلفية
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    console.log("[LocationService] BG permission:", bgStatus);

    // 3. Android: افتح إعدادات تحسين البطارية مباشرة بصمت
    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", [
          { key: "android.provider.extra.PACKAGE_NAME", value: "com.masa.reptracker" },
        ]).catch(() => {});
      } catch {}
    }

    // 4. تحقق هل شغّال
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
      .catch(() => false);

    if (!isRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 30_000,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "نظام المناديب — نشط",
          notificationBody: "التتبع يعمل في الخلفية",
          notificationColor: "#2563EB",
          killServiceOnDestroy: false,
        },
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        deferredUpdatesDistance: 0,
        deferredUpdatesTimeout: 0,
      });
      console.log("[LocationService] Started ✓");
    } else {
      console.log("[LocationService] Already running");
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
    }
  } catch {}
}

export async function isTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
}

/**
 * locationService.ts — تتبع الموقع في الخلفية
 */
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
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

/** طلب أذونات الإشعارات فقط عند الإقلاع؛ الموقع يطلبه التتبع عند الحاجة. */
export async function requestAllPermissions(): Promise<void> {
  try {
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  } catch {}
}

export async function startBackgroundTracking(): Promise<boolean> {
  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") return false;

    await Location.requestBackgroundPermissionsAsync();

    if (Platform.OS === "android") {
      try {
        await Linking.sendIntent("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", [
          { key: "android.provider.extra.PACKAGE_NAME", value: "com.masa.reptracker" },
        ]).catch(() => {});
      } catch {}
    }

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

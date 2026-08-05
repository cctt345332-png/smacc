import { Stack } from "expo-router";
// استيراد مهمة التتبع عند بدء التطبيق
import "../src/locationTask";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}

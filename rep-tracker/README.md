# Rep Tracker — تطبيق تتبع المناديب

## المتطلبات
- Node.js 18+
- Expo CLI: `npm install -g expo-cli eas-cli`
- حساب Expo: https://expo.dev

## التثبيت
```bash
cd rep-tracker
npm install
```

## تشغيل للتطوير
```bash
npx expo start
```

## بناء APK للاختبار
```bash
eas build --platform android --profile preview
```

## بناء APK للإنتاج
```bash
eas build --platform android --profile production
```

## تغيير عنوان السيرفر
في `app/index.tsx` السطر 23-24:
```ts
const APP_URL = "https://api.masa-erp.com";
const API_URL = "https://api.masa-erp.com";
```

## كيف يعمل
1. يفتح تطبيق الويب في WebView
2. بمجرد تسجيل الدخول، يقرأ التوكن من localStorage تلقائياً
3. يبدأ تتبع الموقع في الخلفية كل دقيقة
4. يرسل الموقع لـ API حتى عند إغلاق التطبيق
5. يتوقف التتبع عند تسجيل الخروج

## الأذونات المطلوبة
- موقع دائم (في الخلفية)
- إشعارات (لعرض شريط التتبع على Android)

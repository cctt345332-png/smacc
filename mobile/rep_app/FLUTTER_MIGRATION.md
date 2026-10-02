# تحويل تطبيق المندوب إلى Flutter

تم تنفيذ النسخة الأولى داخل هذا المشروع وتشمل:

- تسجيل الدخول عبر `POST /api/v1/auth/login`.
- حفظ `access_token` محليًا وإرساله في ترويسة `Authorization`.
- استعادة الجلسة بعد إغلاق التطبيق.
- جلب ملف المندوب وملخص الأداء من:
  - `GET /api/v1/reps/me/profile`
  - `GET /api/v1/reps/me/summary`
- داشبورد عربية RTL مع مؤشرات المبيعات، الفواتير، التحصيل، المتبقي والمخزون.
- معالجة انتهاء الجلسة `401`، التحميل، الخطأ، التحديث وتسجيل الخروج.

## التشغيل

عنوان الخلفية الافتراضي مضبوط على `https://api.masa-erp.com/api/v1`، وهو عنوان محاكي Android للوصول إلى خادم يعمل على جهاز التطوير.

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

عند تجربة هاتف فعلي، استخدم عنوان IP لجهاز الخادم على الشبكة نفسها:

```bash
flutter run --dart-define=API_BASE_URL=http://192.168.0.18:8000/api/v1
```

## بناء APK

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://your-domain.com/api/v1
```

يخرج الملف عادة في:

```text
build/app/outputs/flutter-apk/release/app-release.apk
```

> ملاحظة: لم يتم تنفيذ `flutter pub get` أو `flutter build apk` في هذه البيئة لأن Flutter SDK غير مثبت في الـ sandbox الحالي. تم تجهيز المشروع وملف Android للتنفيذ مباشرة على بيئة Flutter/Android SDK.

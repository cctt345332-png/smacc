# Masar Biometric Agent

برنامج Windows خفيف يعمل في الخلفية، يراقب مجلد `inbox` لملفات CSV المصدّرة من جهاز البصمة، يحولها إلى صيغة Masar، ويحفظها في طابور SQLite محلي ثم يرسلها إلى الخادم عبر HTTPS. إذا انقطع الإنترنت تبقى السجلات محلياً وتُرسل عند عودة الاتصال.

## إعداد الجهاز

1. من Masar افتح: الموارد البشرية ← أجهزة البصمة.
2. أنشئ الجهاز واحفظ `device_id` و`device_key` الذي يظهر مرة واحدة.
3. انسخ `config.example.json` إلى `config.json` وعدّل القيم:

```json
{
  "server_url": "https://api.masa-erp.com",
  "device_id": "معرف الجهاز من مسار",
  "device_key": "مفتاح الجهاز من مسار",
  "watch_folder": "C:/MasarBiometricAgent/inbox",
  "interval_seconds": 30
}
```

4. ضع ملفات CSV التي يصدرها جهاز البصمة داخل مجلد `inbox`.
5. الحد الأدنى لأسماء الأعمدة المقبولة:
   - `device_user_id` أو `user_id` أو `userid` أو `pin`
   - `occurred_at` أو `timestamp` أو `datetime`
   - اختياري: `event_type`, `external_id`

## بناء نسخة Windows

على جهاز Windows:

```powershell
py -m pip install pyinstaller
pyinstaller --onefile --noconsole --name MasarBiometricAgent agent.py
```

الملف الناتج سيكون داخل `dist/MasarBiometricAgent.exe`.

للتشغيل التلقائي، أنشئ اختصاراً للملف داخل:

```text
shell:startup
```

## المرحلة الحالية

هذه النسخة تدعم ملفات CSV المصدرة من أجهزة البصمة. جهاز ZKTeco F22 يمكن ربطه مباشرة عبر ADMS، ولا يحتاج هذا البرنامج الوسيط عند تفعيل ADMS في الجهاز. يبقى البرنامج مفيداً للأجهزة التي تصدّر CSV فقط.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'app/data/api_client.dart';
import 'app/data/push_notification_service.dart';
import 'app/data/session_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final preferences = await SharedPreferences.getInstance();
  final sessionStore = SessionStore(preferences);
  final apiClient = ApiClient(sessionStore: sessionStore);
  try {
    await PushNotificationService.instance.initialize(apiClient);
  } catch (_) {
    // لا نمنع تشغيل التطبيق إذا لم تكتمل إعدادات Firebase على جهاز معين.
  }
  runApp(MasarApp(apiClient: apiClient, sessionStore: sessionStore));
}

class MasarApp extends StatelessWidget {
  const MasarApp({
    required this.apiClient,
    required this.sessionStore,
    super.key,
  });
  final ApiClient apiClient;
  final SessionStore sessionStore;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'مسار - تطبيق المندوب',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF3E0865)),
        scaffoldBackgroundColor: const Color(0xFFF8F6FA),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE1D8E7)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE1D8E7)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF3E0865), width: 1.5),
          ),
        ),
      ),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) =>
          Directionality(textDirection: TextDirection.rtl, child: child!),
      home: App(apiClient: apiClient, sessionStore: sessionStore),
    );
  }
}

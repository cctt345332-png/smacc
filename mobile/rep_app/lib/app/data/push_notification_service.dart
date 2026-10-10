import 'dart:async';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';

const _importantChannel = AndroidNotificationChannel(
  'important_notifications',
  'إشعارات مسار المهمة',
  description: 'إشعارات الفواتير والمصروفات والحضور',
  importance: Importance.high,
  playSound: true,
);

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

class PushNotificationService {
  PushNotificationService._();
  static final instance = PushNotificationService._();

  final _messaging = FirebaseMessaging.instance;
  final _local = FlutterLocalNotificationsPlugin();
  ApiClient? _apiClient;
  bool _initialized = false;

  Future<void> initialize(ApiClient apiClient) async {
    _apiClient = apiClient;
    if (!_initialized) {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      await _requestPermission();
      await _configureLocalNotifications();
      FirebaseMessaging.onMessage.listen(_showForegroundNotification);
      _messaging.onTokenRefresh.listen(_registerToken);
      FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);
      _initialized = true;
    }
    await _registerCurrentToken();
    unawaited(_retryTokenRegistration());
  }

  Future<void> _retryTokenRegistration() async {
    for (final delay in const [
      Duration(seconds: 2),
      Duration(seconds: 5),
      Duration(seconds: 10),
    ]) {
      await Future<void>.delayed(delay);
      await _registerCurrentToken();
    }
  }

  Future<void> _requestPermission() async {
    await _messaging.requestPermission(alert: true, badge: true, sound: true);
  }

  Future<void> _configureLocalNotifications() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(
      android: android,
      iOS: DarwinInitializationSettings(),
    );
    await _local.initialize(settings: settings);
    final androidPlugin = _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    await androidPlugin?.createNotificationChannel(_importantChannel);
  }

  Future<void> _registerCurrentToken() async {
    try {
      final token = await _messaging.getToken();
      if (token != null) await _registerToken(token);
    } catch (_) {
      // لا نوقف التطبيق إذا كان الجهاز بلا Google Play Services أو لم يسجل الدخول بعد.
    }
  }

  Future<void> _registerToken(String token) async {
    final apiClient = _apiClient;
    if (apiClient == null || apiClient.sessionStore.token?.isNotEmpty != true)
      return;
    try {
      await apiClient.post('/notifications/devices/register', {
        'fcm_token': token,
        'platform': Platform.isAndroid ? 'android' : 'ios',
        'device_name': Platform.operatingSystem,
      });
    } catch (_) {
      // يعاد التسجيل عند فتح التطبيق أو عند تحديث الـ token.
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    final title =
        notification?.title ?? message.data['title']?.toString() ?? 'مسار ERP';
    final body = notification?.body ?? message.data['body']?.toString() ?? '';
    await _local.show(
      id: message.hashCode,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'important_notifications',
          'إشعارات مسار المهمة',
          channelDescription: 'إشعارات الفواتير والمصروفات والحضور',
          importance: Importance.high,
          priority: Priority.high,
          playSound: true,
          enableVibration: true,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data['reference_id']?.toString(),
    );
  }

  void _handleOpenedMessage(RemoteMessage message) {
    // فتح الصفحة المرتبطة سيضاف إلى موجه التطبيق بعد استقرار مسارات الشاشات الحالية.
  }
}

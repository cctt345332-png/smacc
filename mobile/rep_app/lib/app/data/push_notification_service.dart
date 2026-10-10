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
  Future<void>? _initializationFuture;
  bool _initialized = false;

  Future<String> initialize(ApiClient apiClient) async {
    _apiClient = apiClient;
    if (!_initialized) {
      _initializationFuture ??= _initializeFirebase();
      try {
        await _initializationFuture;
      } catch (_) {
        _initializationFuture = null;
        return 'firebase_init_error';
      }
    }
    final status = await _registerCurrentToken();
    unawaited(_retryTokenRegistration());
    return status;
  }

  Future<void> _initializeFirebase() async {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await _requestPermission();
    await _configureLocalNotifications();
    FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    _messaging.onTokenRefresh.listen(
      (token) => unawaited(_registerToken(token)),
    );
    FirebaseMessaging.onMessageOpenedApp.listen(_handleOpenedMessage);
    _initialized = true;
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

  Future<String> _registerCurrentToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) return 'no_fcm_token';
      return await _registerToken(token);
    } catch (error) {
      return 'firebase_token_error_${error.runtimeType}';
    }
  }

  Future<String> _registerToken(String token) async {
    final apiClient = _apiClient;
    if (apiClient == null || apiClient.sessionStore.token?.isNotEmpty != true)
      return 'waiting_session';
    try {
      await apiClient.post('/notifications/devices/register', {
        'fcm_token': token,
        'platform': Platform.isAndroid ? 'android' : 'ios',
        'device_name': Platform.operatingSystem,
      });
      return 'registered';
    } on ApiException catch (error) {
      return 'api_error_${error.statusCode}';
    } catch (_) {
      return 'api_error';
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

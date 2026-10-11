import 'package:firebase_core/firebase_core.dart';

/// إعدادات Firebase العامة لتطبيق SMACC Android الإنتاجي.
/// لا تحتوي على مفتاح خدمة خاص؛ مفتاح API هنا مخصص لتطبيق Android.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    return const FirebaseOptions(
      apiKey: 'AIzaSyDY_Iw_uM96E4g7R68PkoImy3wOcDG3XiQ',
      appId: '1:978690759954:android:7746e92fafb2bc94ba67cb',
      messagingSenderId: '978690759954',
      projectId: 'smacc-production',
      storageBucket: 'smacc-production.firebasestorage.app',
    );
  }
}

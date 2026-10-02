import 'package:flutter_test/flutter_test.dart';
import 'package:masar_rep_app/app/data/api_client.dart';
import 'package:masar_rep_app/app/data/session_store.dart';
import 'package:masar_rep_app/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('يعرض شاشة تسجيل الدخول بالعربية', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final store = SessionStore(await SharedPreferences.getInstance());
    await tester.pumpWidget(MasarApp(apiClient: ApiClient(sessionStore: store), sessionStore: store));
    expect(find.text('تسجيل الدخول'), findsOneWidget);
    expect(find.text('البريد الإلكتروني'), findsOneWidget);
  });
}

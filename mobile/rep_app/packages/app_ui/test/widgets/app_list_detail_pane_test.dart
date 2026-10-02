import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Future<void> pumpAt(
    WidgetTester tester,
    double width, {
    required Widget? detail,
  }) async {
    tester.view.physicalSize = Size(width, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppListDetailPane(
            master: const Text('master'),
            detail: detail,
            placeholder: const Text('placeholder'),
          ),
        ),
      ),
    );
  }

  group('AppListDetailPane', () {
    testWidgets('narrow width shows only the master', (tester) async {
      await pumpAt(tester, 500, detail: const Text('detail'));

      expect(find.text('master'), findsOneWidget);
      expect(find.text('detail'), findsNothing);
      expect(find.text('placeholder'), findsNothing);
    });

    testWidgets('wide width shows master and detail side by side', (
      tester,
    ) async {
      await pumpAt(tester, 1000, detail: const Text('detail'));

      expect(find.text('master'), findsOneWidget);
      expect(find.text('detail'), findsOneWidget);
      expect(find.text('placeholder'), findsNothing);
    });

    testWidgets('wide width with no selection shows the placeholder', (
      tester,
    ) async {
      await pumpAt(tester, 1000, detail: null);

      expect(find.text('master'), findsOneWidget);
      expect(find.text('placeholder'), findsOneWidget);
    });
  });
}

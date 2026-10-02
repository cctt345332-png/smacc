import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  Widget host(Widget child) => MaterialApp(home: Scaffold(body: child));

  group('AppNetworkImage semantics', () {
    testWidgets('exposes the semantic label when provided', (tester) async {
      // Empty URL renders the error state synchronously (no network/animation).
      await tester.pumpWidget(
        host(const AppNetworkImage(imageUrl: '', semanticLabel: 'Profile')),
      );

      expect(find.bySemanticsLabel('Profile'), findsOneWidget);
    });

    testWidgets('is hidden from semantics when no label is given', (
      tester,
    ) async {
      await tester.pumpWidget(host(const AppNetworkImage(imageUrl: '')));

      final node = tester.getSemantics(find.byType(AppNetworkImage));
      expect(node.label, isEmpty);
    });
  });
}

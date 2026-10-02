import 'package:analytics/analytics.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:test_utils/test_utils.dart';

void main() {
  group('AnalyticsRouteObserver', () {
    late MockAnalyticsService analytics;
    late AnalyticsRouteObserver observer;

    setUp(() {
      analytics = MockAnalyticsService();
      stubAnalyticsService(analytics);
      observer = AnalyticsRouteObserver(analytics);
    });

    test('tracks named page routes on push', () {
      final route = MaterialPageRoute<void>(
        settings: const RouteSettings(name: 'home'),
        builder: (_) => const SizedBox.shrink(),
      );

      observer.didPush(route, null);

      verify(() => analytics.logScreenView(screenName: 'home')).called(1);
    });

    test('ignores unnamed page routes', () {
      final route = MaterialPageRoute<void>(
        builder: (_) => const SizedBox.shrink(),
      );

      observer.didPush(route, null);

      verifyNever(
        () => analytics.logScreenView(screenName: any(named: 'screenName')),
      );
    });
  });
}

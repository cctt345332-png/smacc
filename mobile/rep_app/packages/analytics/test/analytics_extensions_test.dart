import 'package:analytics/analytics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:test_utils/test_utils.dart';

void main() {
  group('AnalyticsService extensions', () {
    late MockAnalyticsService analytics;

    setUp(() {
      analytics = MockAnalyticsService();
      stubAnalyticsService(analytics);
    });

    test('trackBookmarkCreated logs normalized bookmark params', () async {
      await analytics.trackBookmarkCreated(
        bookmarkId: 'b-1',
        tagCount: 2,
        hasDescription: true,
      );

      final captured = verify(
        () => analytics.logEvent(
          AnalyticsEvents.bookmarkCreated,
          parameters: captureAny(named: 'parameters'),
        ),
      ).captured.single;

      expect(captured, {
        AnalyticsParams.bookmarkId: 'b-1',
        AnalyticsParams.tagCount: 2,
        AnalyticsParams.hasDescription: 1,
      });
    });

    test('trackBookmarkDeleteFailed logs source and error type', () async {
      await analytics.trackBookmarkDeleteFailed(
        bookmarkId: 'b-1',
        source: AnalyticsSources.list,
        errorType: 'UnknownFailure',
      );

      final captured = verify(
        () => analytics.logEvent(
          AnalyticsEvents.bookmarkDeleteFailed,
          parameters: captureAny(named: 'parameters'),
        ),
      ).captured.single;

      expect(captured, {
        AnalyticsParams.bookmarkId: 'b-1',
        AnalyticsParams.source: AnalyticsSources.list,
        AnalyticsParams.errorType: 'UnknownFailure',
      });
    });

    test('trackBookmarkSearch logs query metadata only', () async {
      await analytics.trackBookmarkSearch(queryLength: 5, resultCount: 3);

      final captured = verify(
        () => analytics.logEvent(
          AnalyticsEvents.bookmarkSearch,
          parameters: captureAny(named: 'parameters'),
        ),
      ).captured.single;

      expect(captured, {
        AnalyticsParams.queryLength: 5,
        AnalyticsParams.resultCount: 3,
      });
    });

    test('trackNotificationOpened logs payload size', () async {
      await analytics.trackNotificationOpened(payloadKeyCount: 4);

      final captured = verify(
        () => analytics.logEvent(
          AnalyticsEvents.notificationOpened,
          parameters: captureAny(named: 'parameters'),
        ),
      ).captured.single;

      expect(captured, {AnalyticsParams.payloadKeyCount: 4});
    });

    test('trackSignOut logs sign out event', () async {
      await analytics.trackSignOut();

      verify(() => analytics.logEvent(AnalyticsEvents.signOut)).called(1);
    });
  });
}

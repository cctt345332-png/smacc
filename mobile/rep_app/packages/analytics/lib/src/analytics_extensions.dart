import 'analytics_events.dart';
import 'analytics_service.dart';

export 'analytics_events.dart' show AnalyticsSources;

extension AuthAnalytics on AnalyticsService {
  Future<void> trackLoginFailed({required String errorType}) {
    return logEvent(
      AnalyticsEvents.loginFailed,
      parameters: {AnalyticsParams.errorType: errorType},
    );
  }

  Future<void> trackSignOut() => logEvent(AnalyticsEvents.signOut);

  Future<void> trackAccountDeleted() =>
      logEvent(AnalyticsEvents.accountDeleted);
}

extension ThemeAnalytics on AnalyticsService {
  Future<void> trackThemeModeChanged(String mode) {
    return logEvent(
      AnalyticsEvents.themeModeChanged,
      parameters: {AnalyticsParams.themeMode: mode},
    );
  }

  Future<void> trackThemeSchemeChanged(String scheme) {
    return logEvent(
      AnalyticsEvents.themeSchemeChanged,
      parameters: {AnalyticsParams.themeScheme: scheme},
    );
  }
}

extension BookmarkAnalytics on AnalyticsService {
  Future<void> trackBookmarkViewed({
    required String bookmarkId,
    required int tagCount,
    required bool hasDescription,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkViewed,
      parameters: _bookmarkParams(
        bookmarkId: bookmarkId,
        tagCount: tagCount,
        hasDescription: hasDescription,
      ),
    );
  }

  Future<void> trackBookmarkCreated({
    required String bookmarkId,
    required int tagCount,
    required bool hasDescription,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkCreated,
      parameters: _bookmarkParams(
        bookmarkId: bookmarkId,
        tagCount: tagCount,
        hasDescription: hasDescription,
      ),
    );
  }

  Future<void> trackBookmarkUpdated({
    required String bookmarkId,
    required int tagCount,
    required bool hasDescription,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkUpdated,
      parameters: _bookmarkParams(
        bookmarkId: bookmarkId,
        tagCount: tagCount,
        hasDescription: hasDescription,
      ),
    );
  }

  Future<void> trackBookmarkDeleted({
    required String bookmarkId,
    required String source,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkDeleted,
      parameters: {
        AnalyticsParams.bookmarkId: bookmarkId,
        AnalyticsParams.source: source,
      },
    );
  }

  Future<void> trackBookmarkDeleteFailed({
    required String bookmarkId,
    required String source,
    required String errorType,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkDeleteFailed,
      parameters: {
        AnalyticsParams.bookmarkId: bookmarkId,
        AnalyticsParams.source: source,
        AnalyticsParams.errorType: errorType,
      },
    );
  }

  Future<void> trackBookmarkShared({
    required String bookmarkId,
    required String source,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkShared,
      parameters: {
        AnalyticsParams.bookmarkId: bookmarkId,
        AnalyticsParams.source: source,
      },
    );
  }

  Future<void> trackBookmarkOpened({
    required String bookmarkId,
    required String source,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkOpened,
      parameters: {
        AnalyticsParams.bookmarkId: bookmarkId,
        AnalyticsParams.source: source,
      },
    );
  }

  Future<void> trackBookmarkSearch({
    required int queryLength,
    required int resultCount,
  }) {
    return logEvent(
      AnalyticsEvents.bookmarkSearch,
      parameters: {
        AnalyticsParams.queryLength: queryLength,
        AnalyticsParams.resultCount: resultCount,
      },
    );
  }

  Future<void> trackBookmarkSyncRetried() {
    return logEvent(AnalyticsEvents.bookmarkSyncRetried);
  }
}

extension NotificationAnalytics on AnalyticsService {
  Future<void> trackNotificationOpened({required int payloadKeyCount}) {
    return logEvent(
      AnalyticsEvents.notificationOpened,
      parameters: {AnalyticsParams.payloadKeyCount: payloadKeyCount},
    );
  }
}

extension ProfileAnalytics on AnalyticsService {
  Future<void> trackUserIdCopied() {
    return logEvent(
      AnalyticsEvents.userIdCopied,
      parameters: {AnalyticsParams.source: AnalyticsSources.profile},
    );
  }
}

Map<String, Object> _bookmarkParams({
  required String bookmarkId,
  required int tagCount,
  required bool hasDescription,
}) {
  return {
    AnalyticsParams.bookmarkId: bookmarkId,
    AnalyticsParams.tagCount: tagCount,
    AnalyticsParams.hasDescription: hasDescription ? 1 : 0,
  };
}

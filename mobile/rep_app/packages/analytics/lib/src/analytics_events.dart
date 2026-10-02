abstract final class AnalyticsEvents {
  static const loginFailed = 'login_failed';
  static const signOut = 'sign_out';
  static const accountDeleted = 'account_deleted';
  static const themeModeChanged = 'theme_mode_changed';
  static const themeSchemeChanged = 'theme_scheme_changed';
  static const bookmarkViewed = 'bookmark_viewed';
  static const bookmarkCreated = 'bookmark_created';
  static const bookmarkUpdated = 'bookmark_updated';
  static const bookmarkDeleted = 'bookmark_deleted';
  static const bookmarkDeleteFailed = 'bookmark_delete_failed';
  static const bookmarkShared = 'bookmark_shared';
  static const bookmarkOpened = 'bookmark_opened';
  static const bookmarkSearch = 'bookmark_search';
  static const bookmarkSyncRetried = 'bookmark_sync_retried';
  static const notificationOpened = 'notification_opened';
  static const userIdCopied = 'user_id_copied';
}

abstract final class AnalyticsParams {
  static const bookmarkId = 'bookmark_id';
  static const errorType = 'error_type';
  static const hasDescription = 'has_description';
  static const method = 'method';
  static const payloadKeyCount = 'payload_key_count';
  static const queryLength = 'query_length';
  static const resultCount = 'result_count';
  static const source = 'source';
  static const tagCount = 'tag_count';
  static const themeMode = 'theme_mode';
  static const themeScheme = 'theme_scheme';
}

abstract final class AnalyticsSources {
  static const detail = 'detail';
  static const list = 'list';
  static const profile = 'profile';
}

import 'package:injectable/injectable.dart';

@singleton
class EnvConfig {
  const EnvConfig();

  String get flavor =>
      const String.fromEnvironment('FLAVOR', defaultValue: 'dev');

  String get apiBaseUrl => const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:8080',
  );

  /// HTTP connect/receive timeout, configurable per flavor via the
  /// `API_TIMEOUT_SECONDS` dart-define. Defaults to 10 seconds.
  Duration get apiTimeout => const Duration(
    seconds: int.fromEnvironment('API_TIMEOUT_SECONDS', defaultValue: 10),
  );

  bool get isDev => flavor == 'dev';
  bool get isStaging => flavor == 'staging';
  bool get isProd => flavor == 'prod';
}

import 'package:config/config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // With no `--dart-define`s supplied (as in a plain `flutter test` run),
  // EnvConfig must fall back to its dev defaults. This guards against
  // accidental changes to those compile-time defaults.
  group('EnvConfig defaults', () {
    const env = EnvConfig();

    test('defaults to the dev flavor', () {
      expect(env.flavor, 'dev');
      expect(env.isDev, isTrue);
      expect(env.isStaging, isFalse);
      expect(env.isProd, isFalse);
    });

    test('defaults the base URL to localhost', () {
      expect(env.apiBaseUrl, 'http://localhost:8080');
    });

    test('defaults the API timeout to 10 seconds', () {
      expect(env.apiTimeout, const Duration(seconds: 10));
    });
  });
}

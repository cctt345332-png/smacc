import 'package:flutter_test/flutter_test.dart';
import 'package:storage/storage.dart';
import 'package:test_utils/test_utils.dart';

void main() {
  const installedFlagKey = 'app.installed';

  late MockSharedPreferences prefs;
  late MockFlutterSecureStorage secureStorage;
  late KeychainResetOnReinstall reset;

  setUp(() {
    prefs = MockSharedPreferences();
    secureStorage = MockFlutterSecureStorage();
    reset = KeychainResetOnReinstall(prefs, secureStorage);
  });

  group('KeychainResetOnReinstall', () {
    test('wipes secure storage and sets the flag on first run', () async {
      when(() => prefs.getBool(installedFlagKey)).thenReturn(null);
      when(secureStorage.deleteAll).thenAnswer((_) async {});
      when(
        () => prefs.setBool(installedFlagKey, true),
      ).thenAnswer((_) async => true);

      await reset.run();

      verify(secureStorage.deleteAll).called(1);
      verify(() => prefs.setBool(installedFlagKey, true)).called(1);
    });

    test('does nothing when the flag is already set', () async {
      when(() => prefs.getBool(installedFlagKey)).thenReturn(true);

      await reset.run();

      verifyNever(secureStorage.deleteAll);
      verifyNever(() => prefs.setBool(any(), any()));
    });

    test('leaves the flag unset if the wipe fails, so it retries', () async {
      when(() => prefs.getBool(installedFlagKey)).thenReturn(null);
      when(secureStorage.deleteAll).thenThrow(Exception('keychain error'));

      await expectLater(reset.run(), throwsException);

      verifyNever(() => prefs.setBool(any(), any()));
    });
  });
}

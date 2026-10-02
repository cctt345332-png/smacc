import 'package:config/config.dart';
import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:test_utils/test_utils.dart';

class _MockFirebaseRemoteConfig extends Mock implements FirebaseRemoteConfig {}

void main() {
  setUpAll(() {
    registerFallbackValue(
      RemoteConfigSettings(
        fetchTimeout: Duration.zero,
        minimumFetchInterval: Duration.zero,
      ),
    );
  });

  late _MockFirebaseRemoteConfig remoteConfig;
  late FirebaseRemoteConfigService service;

  setUp(() {
    remoteConfig = _MockFirebaseRemoteConfig();
    service = FirebaseRemoteConfigService(remoteConfig);

    when(() => remoteConfig.setConfigSettings(any())).thenAnswer((_) async {});
    when(() => remoteConfig.setDefaults(any())).thenAnswer((_) async {});
    when(() => remoteConfig.fetchAndActivate()).thenAnswer((_) async => true);
  });

  group('init', () {
    test('applies settings, defaults, then fetches', () async {
      await service.init();

      verify(() => remoteConfig.setConfigSettings(any())).called(1);
      verify(() => remoteConfig.fetchAndActivate()).called(1);
      final captured =
          verify(
                () => remoteConfig.setDefaults(captureAny()),
              ).captured.single
              as Map<String, Object>;
      expect(captured['example_new_profile_ui'], false);
    });

    test('swallows fetch failures so launch is never blocked', () async {
      when(
        () => remoteConfig.fetchAndActivate(),
      ).thenThrow(Exception('offline'));

      await expectLater(service.init(), completes);
    });
  });

  group('reads', () {
    test('isEnabled delegates to the flag key', () {
      when(
        () => remoteConfig.getBool('example_new_profile_ui'),
      ).thenReturn(true);

      expect(service.isEnabled(FeatureFlag.exampleNewProfileUi), isTrue);
    });

    test('typed getters delegate to remote config', () {
      when(() => remoteConfig.getString('s')).thenReturn('v');
      when(() => remoteConfig.getInt('i')).thenReturn(7);
      when(() => remoteConfig.getDouble('d')).thenReturn(1.5);

      expect(service.getString('s'), 'v');
      expect(service.getInt('i'), 7);
      expect(service.getDouble('d'), 1.5);
    });
  });
}

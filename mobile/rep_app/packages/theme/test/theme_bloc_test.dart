import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:test_utils/test_utils.dart';
import 'package:theme/theme.dart';

void main() {
  late MockSharedPreferences mockPrefs;
  late MockAnalyticsService mockAnalytics;
  late ThemeBloc bloc;

  setUp(() {
    mockPrefs = MockSharedPreferences();
    mockAnalytics = MockAnalyticsService();
    stubAnalyticsService(mockAnalytics);
    registerFallbackValue('');
    when(() => mockPrefs.getString(any())).thenReturn(null);
    when(() => mockPrefs.setString(any(), any())).thenAnswer((_) async => true);
    bloc = ThemeBloc(mockPrefs, mockAnalytics);
  });

  tearDown(() {
    bloc.close();
  });

  group('ThemeBloc', () {
    test('initial state has default scheme and system mode when no prefs', () {
      expect(bloc.state.mode, ThemeMode.system);
      expect(bloc.state.scheme, ThemeState.defaultScheme);
    });

    test('reads initial state from SharedPreferences', () {
      when(() => mockPrefs.getString('app.theme_mode')).thenReturn('dark');
      when(() => mockPrefs.getString('app.theme_scheme')).thenReturn('indigo');

      final c = ThemeBloc(mockPrefs, mockAnalytics);
      expect(c.state.mode, ThemeMode.dark);
      expect(c.state.scheme, FlexScheme.indigo);
      c.close();
    });

    group('setMode', () {
      blocTest<ThemeBloc, ThemeState>(
        'emits new mode and persists to prefs',
        build: () => bloc,
        act: (bloc) => bloc.add(const ThemeModeChanged(ThemeMode.dark)),
        expect: () => [
          predicate<ThemeState>(
            (s) =>
                s.mode == ThemeMode.dark &&
                s.scheme == ThemeState.defaultScheme,
          ),
        ],
        verify: (_) {
          verify(() => mockPrefs.setString('app.theme_mode', 'dark')).called(1);
          verifyNever(
            () => mockPrefs.setString('app.theme_scheme', any()),
          );
          verify(
            () => mockAnalytics.logEvent(
              'theme_mode_changed',
              parameters: any(named: 'parameters'),
            ),
          ).called(1);
        },
      );

      blocTest<ThemeBloc, ThemeState>(
        'does nothing when mode is unchanged',
        build: () => bloc,
        act: (bloc) => bloc.add(const ThemeModeChanged(ThemeMode.system)),
        expect: () => <ThemeState>[],
      );
    });

    group('setScheme', () {
      blocTest<ThemeBloc, ThemeState>(
        'emits new scheme and persists to prefs',
        build: () => bloc,
        act: (bloc) => bloc.add(const ThemeSchemeChanged(FlexScheme.mango)),
        expect: () => [
          predicate<ThemeState>(
            (s) => s.mode == ThemeMode.system && s.scheme == FlexScheme.mango,
          ),
        ],
        verify: (_) {
          verifyNever(() => mockPrefs.setString('app.theme_mode', any()));
          verify(
            () => mockPrefs.setString('app.theme_scheme', 'mango'),
          ).called(1);
          verify(
            () => mockAnalytics.logEvent(
              'theme_scheme_changed',
              parameters: any(named: 'parameters'),
            ),
          ).called(1);
        },
      );

      blocTest<ThemeBloc, ThemeState>(
        'does nothing when scheme is unchanged',
        build: () => bloc,
        act: (bloc) =>
            bloc.add(const ThemeSchemeChanged(ThemeState.defaultScheme)),
        expect: () => <ThemeState>[],
      );
    });
  });
}

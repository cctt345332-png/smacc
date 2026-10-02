part of 'theme_bloc.dart';

sealed class ThemeEvent {
  const ThemeEvent();
}

final class ThemeModeChanged extends ThemeEvent {
  const ThemeModeChanged(this.mode);

  final ThemeMode mode;
}

final class ThemeSchemeChanged extends ThemeEvent {
  const ThemeSchemeChanged(this.scheme);

  final FlexScheme scheme;
}

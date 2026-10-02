import 'package:flex_color_scheme/flex_color_scheme.dart';
import 'package:flutter/material.dart';

class ThemeState {
  const ThemeState({required this.mode, required this.scheme});

  final ThemeMode mode;
  final FlexScheme scheme;

  static const FlexScheme defaultScheme = FlexScheme.bahamaBlue;

  ThemeState copyWith({ThemeMode? mode, FlexScheme? scheme}) =>
      ThemeState(mode: mode ?? this.mode, scheme: scheme ?? this.scheme);
}

import 'package:flutter/material.dart';

/// Semantic status colors that aren't part of Material's [ColorScheme].
///
/// Material 3 covers brand and error roles, but leaves success / warning / info
/// up to the app. Register this extension on [ThemeData] so those roles are
/// theme-aware (and animate across light/dark) instead of being hardcoded at
/// call sites. Access via `Theme.of(context).extension<SemanticColors>()` or
/// the `context.semanticColors` getter.
@immutable
class SemanticColors extends ThemeExtension<SemanticColors> {
  const SemanticColors({
    required this.success,
    required this.onSuccess,
    required this.warning,
    required this.onWarning,
    required this.info,
    required this.onInfo,
  });

  /// Tokens tuned for light themes.
  static const light = SemanticColors(
    success: Color(0xFF2E7D32),
    onSuccess: Color(0xFFFFFFFF),
    warning: Color(0xFFED6C02),
    onWarning: Color(0xFFFFFFFF),
    info: Color(0xFF0288D1),
    onInfo: Color(0xFFFFFFFF),
  );

  /// Tokens tuned for dark themes.
  static const dark = SemanticColors(
    success: Color(0xFF66BB6A),
    onSuccess: Color(0xFF003912),
    warning: Color(0xFFFFB74D),
    onWarning: Color(0xFF3E2600),
    info: Color(0xFF4FC3F7),
    onInfo: Color(0xFF00344A),
  );

  /// Indicates a successful or positive state.
  final Color success;

  /// Content color drawn on top of [success].
  final Color onSuccess;

  /// Indicates a cautionary state needing attention.
  final Color warning;

  /// Content color drawn on top of [warning].
  final Color onWarning;

  /// Indicates a neutral, informational state.
  final Color info;

  /// Content color drawn on top of [info].
  final Color onInfo;

  @override
  SemanticColors copyWith({
    Color? success,
    Color? onSuccess,
    Color? warning,
    Color? onWarning,
    Color? info,
    Color? onInfo,
  }) {
    return SemanticColors(
      success: success ?? this.success,
      onSuccess: onSuccess ?? this.onSuccess,
      warning: warning ?? this.warning,
      onWarning: onWarning ?? this.onWarning,
      info: info ?? this.info,
      onInfo: onInfo ?? this.onInfo,
    );
  }

  @override
  SemanticColors lerp(ThemeExtension<SemanticColors>? other, double t) {
    if (other is! SemanticColors) return this;
    return SemanticColors(
      success: Color.lerp(success, other.success, t)!,
      onSuccess: Color.lerp(onSuccess, other.onSuccess, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      onWarning: Color.lerp(onWarning, other.onWarning, t)!,
      info: Color.lerp(info, other.info, t)!,
      onInfo: Color.lerp(onInfo, other.onInfo, t)!,
    );
  }
}

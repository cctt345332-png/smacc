/// Centralized icon and glyph sizes.
///
/// Use these tokens instead of hardcoded `size:` values so icons, avatars, and
/// small inline indicators stay visually consistent and can be tuned in one
/// place.
abstract final class AppIconSize {
  /// 16px - small inline glyphs.
  static const double sm = 16;

  /// 20px - dense controls (e.g. app bar back button).
  static const double md = 20;

  /// 24px - default icon size.
  static const double lg = 24;

  /// 28px - emphasized list/stat icons.
  static const double xl = 28;

  /// 40px - avatars and hero glyphs.
  static const double xxl = 40;

  /// 48px - empty/error state illustrations.
  static const double xxxl = 48;
}

/// Centralized animation/transition durations for UI motion.
///
/// Use these tokens instead of inline `Duration(milliseconds: ...)` values for
/// presentation transitions so motion feels consistent and can be tuned in one
/// place. Behavioral timings (network timeouts, debounce windows, auto-play
/// intervals) are not motion and should stay defined where they are used.
abstract final class AppDurations {
  /// 200ms - quick fades and small state changes.
  static const Duration xfast = Duration(milliseconds: 200);

  /// 250ms - overlay fades (media controls, scrims).
  static const Duration fast = Duration(milliseconds: 250);

  /// 300ms - standard transitions and stagger items.
  static const Duration medium = Duration(milliseconds: 300);

  /// 400ms - entrance slides and emphasized motion.
  static const Duration slow = Duration(milliseconds: 400);

  /// 500ms - elastic scale entrances.
  static const Duration xslow = Duration(milliseconds: 500);

  /// 600ms - long fades.
  static const Duration xxslow = Duration(milliseconds: 600);
}

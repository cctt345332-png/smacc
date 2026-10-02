import 'package:flutter/widgets.dart';

/// Material 3 window-size-class breakpoints used to drive adaptive layouts.
///
/// Widths are in logical pixels. A width below [medium] is treated as
/// `compact` (phones), `[medium, expanded)` as `medium` (small tablets /
/// landscape phones), and `>= expanded` as `expanded` (large tablets /
/// desktop).
abstract final class AppBreakpoints {
  /// Lower bound of the medium window size class.
  static const double medium = 600;

  /// Lower bound of the expanded window size class.
  static const double expanded = 840;
}

/// Window-size-class helpers derived from the current [MediaQuery] width.
///
/// Prefer reading these from a [LayoutBuilder]'s constraints when sizing a
/// specific subtree; use these context getters for whole-screen decisions.
extension BuildContextBreakpoints on BuildContext {
  /// Whether the screen width is below [AppBreakpoints.medium].
  bool get isCompact => MediaQuery.of(this).size.width < AppBreakpoints.medium;

  /// Whether the screen width is within the medium window size class.
  bool get isMedium =>
      MediaQuery.of(this).size.width >= AppBreakpoints.medium &&
      MediaQuery.of(this).size.width < AppBreakpoints.expanded;

  /// Whether the screen width is at or above [AppBreakpoints.expanded].
  bool get isExpanded =>
      MediaQuery.of(this).size.width >= AppBreakpoints.expanded;
}

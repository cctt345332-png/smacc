import 'package:flutter/widgets.dart';

/// Convenience accessors for the ambient [MediaQuery] of a [BuildContext].
///
/// Prefer reading sizing from a [LayoutBuilder]'s constraints when laying out
/// a specific subtree; use these getters for whole-screen decisions.
extension BuildContextMedia on BuildContext {
  /// The nearest [MediaQueryData] for this context.
  MediaQueryData get mediaQuery => MediaQuery.of(this);

  /// The size of the media (e.g. the window or screen).
  Size get screenSize => mediaQuery.size;

  /// Padding obscured by system UI (e.g. notches, status bars).
  EdgeInsets get viewPadding => mediaQuery.viewPadding;

  /// Insets obscured by system UI such as the on-screen keyboard.
  EdgeInsets get viewInsets => mediaQuery.viewInsets;

  /// The bottom view inset, typically the on-screen keyboard height.
  double get bottomInset => mediaQuery.viewInsets.bottom;

  /// The current device [Orientation].
  Orientation get orientation => mediaQuery.orientation;

  /// Whether the device is in landscape orientation.
  bool get isLandscape => orientation == Orientation.landscape;

  /// Whether the device is in portrait orientation.
  bool get isPortrait => orientation == Orientation.portrait;
}

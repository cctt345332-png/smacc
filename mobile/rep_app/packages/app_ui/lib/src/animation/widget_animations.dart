import 'package:flutter/widgets.dart';
import 'package:flutter_animate/flutter_animate.dart';

import 'app_durations.dart';

export 'package:flutter_animate/flutter_animate.dart';

extension WidgetAnimations on Widget {
  /// Fade in while sliding down from slightly above.
  Widget animateSlideDown({
    Duration delay = Duration.zero,
    Duration duration = AppDurations.slow,
  }) => animate(delay: delay)
      .fadeIn(duration: duration)
      .slideY(begin: -0.2, duration: duration, curve: Curves.easeOut);

  /// Fade in while sliding up from slightly below.
  Widget animateSlideUp({
    Duration delay = Duration.zero,
    Duration duration = AppDurations.slow,
  }) => animate(delay: delay)
      .fadeIn(duration: duration)
      .slideY(begin: 0.3, duration: duration, curve: Curves.easeOut);

  /// Fade in while sliding from left.
  Widget animateSlideLeft({
    Duration delay = Duration.zero,
    Duration duration = AppDurations.slow,
  }) => animate(delay: delay)
      .fadeIn(duration: duration)
      .slideX(begin: -0.3, duration: duration, curve: Curves.easeOut);

  /// Fade in while sliding from right.
  Widget animateSlideRight({
    Duration delay = Duration.zero,
    Duration duration = AppDurations.slow,
  }) => animate(delay: delay)
      .fadeIn(duration: duration)
      .slideX(begin: 0.3, duration: duration, curve: Curves.easeOut);

  /// Elastic scale bounce with fade in.
  Widget animateScale({
    Duration delay = Duration.zero,
    Duration duration = AppDurations.xslow,
  }) => animate(delay: delay)
      .scale(duration: duration, curve: Curves.elasticOut)
      .fadeIn(duration: AppDurations.slow);

  /// Fade in only — no slide.
  Widget animateFadeIn({
    Duration delay = Duration.zero,
    Duration duration = AppDurations.slow,
  }) => animate(delay: delay).fadeIn(duration: duration);

  /// Fade in with a horizontal shake — for error messages.
  Widget animateShake({
    Duration delay = Duration.zero,
    Duration duration = AppDurations.medium,
  }) => animate(
    delay: delay,
  ).fadeIn(duration: duration).shake(duration: duration);

  /// Fade in while sliding from right with a small stagger key and delay.
  /// Useful inside list builders where per-item stagger is needed.
  Widget animateStaggerItem(int index, {int delayMs = 50}) =>
      animate(
            key: ValueKey(index),
            delay: Duration(milliseconds: delayMs * index),
          )
          .fadeIn(duration: AppDurations.medium)
          .slideX(
            begin: 0.2,
            duration: AppDurations.medium,
            curve: Curves.easeOut,
          );
}

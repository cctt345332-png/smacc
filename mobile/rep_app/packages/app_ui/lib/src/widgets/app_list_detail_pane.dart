import 'package:flutter/material.dart';

/// A responsive list-detail (master-detail) layout.
///
/// When the available width is at least [twoPaneMinWidth] it shows [master] and
/// the detail side by side; the detail area renders [detail] when non-null, or
/// [placeholder] otherwise. Below that width it shows only [master], and the
/// caller is expected to present the detail via navigation (e.g. a pushed
/// route).
///
/// The threshold is measured against this widget's own constraints, not the
/// screen, so it stays correct when placed next to a navigation rail that
/// already consumes horizontal space.
class AppListDetailPane extends StatelessWidget {
  const AppListDetailPane({
    super.key,
    required this.master,
    required this.detail,
    required this.placeholder,
    this.masterWidth = 360,
    this.twoPaneMinWidth = 700,
  });

  /// The master (list) pane, shown at all sizes.
  final Widget master;

  /// The detail pane shown beside [master] on wide screens, or null when
  /// nothing is selected.
  final Widget? detail;

  /// Shown in the detail area on wide screens when [detail] is null.
  final Widget placeholder;

  /// Fixed width of the master pane in the two-pane layout.
  final double masterWidth;

  /// Minimum available width at which the two-pane layout activates.
  final double twoPaneMinWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < twoPaneMinWidth) {
          return master;
        }
        return Row(
          children: [
            SizedBox(width: masterWidth, child: master),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(child: detail ?? placeholder),
          ],
        );
      },
    );
  }
}

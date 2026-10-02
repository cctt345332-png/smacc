import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_slidable/flutter_slidable.dart' as slidable;
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../../app_ui.dart';

enum AppSlidableActionTone { neutral, primary, destructive }

enum AppSlidableMotion { scroll, drawer, behind, stretch }

typedef AppSlidableActionPressed = void Function(BuildContext context);
typedef AppSlidableConfirmDismiss = FutureOr<bool> Function();

class AppSlidableAction {
  const AppSlidableAction({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.tone = AppSlidableActionTone.neutral,
    this.backgroundColor,
    this.foregroundColor,
    this.flex = 1,
    this.autoClose = true,
    this.borderRadius = BorderRadius.zero,
    this.padding,
  });

  const AppSlidableAction.primary({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.backgroundColor,
    this.foregroundColor,
    this.flex = 1,
    this.autoClose = true,
    this.borderRadius = BorderRadius.zero,
    this.padding,
  }) : tone = AppSlidableActionTone.primary;

  const AppSlidableAction.delete({
    required this.onPressed,
    this.label,
    this.icon = FontAwesomeIcons.trashCan,
    this.backgroundColor,
    this.foregroundColor,
    this.flex = 1,
    this.autoClose = true,
    this.borderRadius = BorderRadius.zero,
    this.padding,
  }) : tone = AppSlidableActionTone.destructive;

  final String? label;
  final FaIconData icon;
  final AppSlidableActionPressed? onPressed;
  final AppSlidableActionTone tone;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final int flex;
  final bool autoClose;
  final BorderRadius borderRadius;
  final EdgeInsets? padding;

  Widget _build(BuildContext context) {
    return slidable.CustomSlidableAction(
      flex: flex,
      autoClose: autoClose,
      onPressed: onPressed == null
          ? null
          : (actionContext) {
              HapticFeedback.lightImpact();
              onPressed!(actionContext);
            },
      backgroundColor: backgroundColor ?? _backgroundColor(context),
      foregroundColor: foregroundColor ?? _foregroundColor(context),
      borderRadius: borderRadius,
      padding: padding,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          FaIcon(icon),
          const SizedBox(height: 4),
          Text(label ?? 'Delete'),
        ],
      ),
    );
  }

  Color _backgroundColor(BuildContext context) {
    return switch (tone) {
      AppSlidableActionTone.neutral => context.colorScheme.secondaryContainer,
      AppSlidableActionTone.primary => context.colorScheme.primaryContainer,
      AppSlidableActionTone.destructive => context.colorScheme.errorContainer,
    };
  }

  Color _foregroundColor(BuildContext context) {
    return switch (tone) {
      AppSlidableActionTone.neutral => context.colorScheme.onSecondaryContainer,
      AppSlidableActionTone.primary => context.colorScheme.onPrimaryContainer,
      AppSlidableActionTone.destructive => context.colorScheme.onErrorContainer,
    };
  }
}

class AppSlidableDismiss {
  const AppSlidableDismiss({
    required this.onDismissed,
    this.confirmDismiss,
    this.closeOnCancel = true,
    this.dragDismissible = true,
    this.dismissThreshold = 0.75,
    this.dismissalDuration = AppDurations.medium,
    this.resizeDuration = AppDurations.medium,
  });

  final VoidCallback onDismissed;
  final AppSlidableConfirmDismiss? confirmDismiss;
  final bool closeOnCancel;
  final bool dragDismissible;
  final double dismissThreshold;
  final Duration dismissalDuration;
  final Duration resizeDuration;

  Widget _build() {
    return slidable.DismissiblePane(
      onDismissed: onDismissed,
      confirmDismiss: confirmDismiss == null
          ? null
          : () async => await confirmDismiss!(),
      closeOnCancel: closeOnCancel,
      dismissThreshold: dismissThreshold,
      dismissalDuration: dismissalDuration,
      resizeDuration: resizeDuration,
    );
  }
}

class AppSlidableAutoCloseGroup extends StatelessWidget {
  const AppSlidableAutoCloseGroup({
    super.key,
    required this.child,
    this.closeWhenOpened = true,
    this.closeWhenTapped = true,
  });

  final Widget child;
  final bool closeWhenOpened;
  final bool closeWhenTapped;

  @override
  Widget build(BuildContext context) {
    return slidable.SlidableAutoCloseBehavior(
      closeWhenOpened: closeWhenOpened,
      closeWhenTapped: closeWhenTapped,
      child: child,
    );
  }
}

class AppSlidable extends StatelessWidget {
  const AppSlidable({
    super.key,
    required this.child,
    this.startActions = const [],
    this.endActions = const [],
    this.startDismissible,
    this.endDismissible,
    this.groupTag,
    this.enabled = true,
    this.closeOnScroll = true,
    this.direction = Axis.horizontal,
    this.dragStartBehavior = DragStartBehavior.down,
    this.useTextDirection = true,
    this.motion = AppSlidableMotion.scroll,
    this.startMotion,
    this.endMotion,
    this.extentRatio,
    this.startExtentRatio,
    this.endExtentRatio,
    this.openThreshold,
    this.closeThreshold,
  });

  final Widget child;
  final List<AppSlidableAction> startActions;
  final List<AppSlidableAction> endActions;
  final AppSlidableDismiss? startDismissible;
  final AppSlidableDismiss? endDismissible;
  final Object? groupTag;
  final bool enabled;
  final bool closeOnScroll;
  final Axis direction;
  final DragStartBehavior dragStartBehavior;
  final bool useTextDirection;
  final AppSlidableMotion motion;
  final AppSlidableMotion? startMotion;
  final AppSlidableMotion? endMotion;
  final double? extentRatio;
  final double? startExtentRatio;
  final double? endExtentRatio;
  final double? openThreshold;
  final double? closeThreshold;

  @override
  Widget build(BuildContext context) {
    return slidable.Slidable(
      groupTag: groupTag,
      enabled: enabled,
      closeOnScroll: closeOnScroll,
      direction: direction,
      dragStartBehavior: dragStartBehavior,
      useTextDirection: useTextDirection,
      startActionPane: _actionPane(
        context,
        actions: startActions,
        dismissible: startDismissible,
        motion: startMotion,
        extentRatio: startExtentRatio,
      ),
      endActionPane: _actionPane(
        context,
        actions: endActions,
        dismissible: endDismissible,
        motion: endMotion,
        extentRatio: endExtentRatio,
      ),
      child: child,
    );
  }

  slidable.ActionPane? _actionPane(
    BuildContext context, {
    required List<AppSlidableAction> actions,
    required AppSlidableDismiss? dismissible,
    required AppSlidableMotion? motion,
    required double? extentRatio,
  }) {
    if (actions.isEmpty) return null;

    return slidable.ActionPane(
      motion: _motion(motion ?? this.motion),
      extentRatio: extentRatio ?? this.extentRatio ?? _extentRatio(actions),
      dismissible: dismissible?._build(),
      dragDismissible: dismissible?.dragDismissible ?? true,
      openThreshold: openThreshold,
      closeThreshold: closeThreshold,
      children: [for (final action in actions) action._build(context)],
    );
  }

  double _extentRatio(List<AppSlidableAction> actions) {
    return (actions.length * 0.25).clamp(0.25, 0.75);
  }

  Widget _motion(AppSlidableMotion motion) {
    return switch (motion) {
      AppSlidableMotion.scroll => const slidable.ScrollMotion(),
      AppSlidableMotion.drawer => const slidable.DrawerMotion(),
      AppSlidableMotion.behind => const slidable.BehindMotion(),
      AppSlidableMotion.stretch => const slidable.StretchMotion(),
    };
  }
}

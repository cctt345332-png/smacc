import 'package:flutter/material.dart';
import 'package:flutter_link_previewer/flutter_link_previewer.dart';

import '../../app_ui.dart';

class AppLinkPreview extends StatelessWidget {
  const AppLinkPreview({
    super.key,
    required this.url,
    this.onTap,
    this.minWidth = 200,
    this.maxWidth = 400,
    this.maxTitleLines = 2,
    this.maxDescriptionLines = 3,
    this.enableAnimation = true,
  });

  final String url;
  final void Function(String)? onTap;
  final double minWidth;
  final double maxWidth;
  final int maxTitleLines;
  final int maxDescriptionLines;
  final bool enableAnimation;

  @override
  Widget build(BuildContext context) {
    final colorScheme = context._colorScheme;
    final textTheme = context._textTheme;

    return LinkPreview(
      text: url,
      onLinkPreviewDataFetched: (_) {},
      onTap: onTap,
      minWidth: minWidth,
      maxWidth: maxWidth,
      maxTitleLines: maxTitleLines,
      maxDescriptionLines: maxDescriptionLines,
      enableAnimation: enableAnimation,
      borderRadius: 12,
      gap: 8,
      sideBorderColor: colorScheme.primary,
      backgroundColor: colorScheme.surfaceContainerHighest,
      titleTextStyle: textTheme.titleSmall?.copyWith(
        color: colorScheme.onSurface,
        fontWeight: FontWeight.w600,
      ),
      descriptionTextStyle: textTheme.bodySmall?.copyWith(
        color: colorScheme.onSurfaceVariant,
      ),
      imageBuilder: (imageUrl) => ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: Image.network(
          imageUrl,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => const SizedBox.shrink(),
        ),
      ),
    );
  }
}

extension _ThemeExt on BuildContext {
  ColorScheme get _colorScheme => Theme.of(this).colorScheme;
  TextTheme get _textTheme => Theme.of(this).textTheme;
}

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../theme/app_theme.dart';
import 'app_loading.dart';

/// A wrapper around [CachedNetworkImage] that provides consistent loading
/// and error states across the app.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.placeholderSize = 24.0,
    this.errorIconSize = 24.0,
    this.color,
    this.colorBlendMode,
    this.borderRadius = BorderRadius.zero,
    this.placeholder,
    this.errorWidget,
    this.semanticLabel,
  });

  /// The URL of the image to load.
  final String imageUrl;

  /// How to inscribe the image into the space allocated during layout.
  final BoxFit fit;

  /// If non-null, require the image to have this width.
  final double? width;

  /// If non-null, require the image to have this height.
  final double? height;

  /// Size of the default loading indicator.
  final double placeholderSize;

  /// Size of the default error icon.
  final double errorIconSize;

  /// If non-null, this color is blended with each image pixel using [colorBlendMode].
  final Color? color;

  /// Used to combine [color] with this image.
  final BlendMode? colorBlendMode;

  /// Optional border radius to clip the image.
  final BorderRadius borderRadius;

  /// Custom widget to display while the image is loading.
  final Widget Function(BuildContext, String)? placeholder;

  /// Custom widget to display if the image fails to load.
  final Widget Function(BuildContext, String, dynamic)? errorWidget;

  /// Describes the image for screen readers. When null the image is treated
  /// as decorative and hidden from the semantics tree.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return _withSemantics(_buildErrorWidget(context, imageUrl, 'Empty URL'));
    }

    final imageWidget = CachedNetworkImage(
      imageUrl: imageUrl,
      fit: fit,
      width: width,
      height: height,
      color: color,
      colorBlendMode: colorBlendMode,
      placeholder: placeholder ?? _buildPlaceholder,
      errorWidget: errorWidget ?? _buildErrorWidget,
    );

    if (borderRadius != BorderRadius.zero) {
      return _withSemantics(
        ClipRRect(borderRadius: borderRadius, child: imageWidget),
      );
    }

    return _withSemantics(imageWidget);
  }

  /// Labels the image for assistive tech, or hides it when purely decorative.
  Widget _withSemantics(Widget child) {
    if (semanticLabel == null) {
      return ExcludeSemantics(child: child);
    }
    return Semantics(image: true, label: semanticLabel, child: child);
  }

  Widget _buildPlaceholder(BuildContext context, String url) {
    return Center(
      child: AppLoading(size: placeholderSize),
    );
  }

  Widget _buildErrorWidget(BuildContext context, String url, dynamic error) {
    return Container(
      width: width,
      height: height,
      color: context.colorScheme.surfaceContainerHighest,
      alignment: Alignment.center,
      child: FaIcon(
        FontAwesomeIcons.image,
        size: errorIconSize,
        color: context.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
      ),
    );
  }
}

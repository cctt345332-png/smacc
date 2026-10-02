import 'dart:io';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:photo_view/photo_view.dart';

import '../../app_ui.dart';

/// A wrapper widget for [PhotoView] that simplifies image zooming,
/// supports different image sources (network, asset, file, custom provider),
/// and integrates customizable loading and error states.
class AppPhotoView extends StatefulWidget {
  const AppPhotoView({
    super.key,
    required this.imageProvider,
    this.heroTag,
    this.minScale,
    this.maxScale,
    this.initialScale,
    this.backgroundDecoration,
    this.loadingBuilder,
    this.errorBuilder,
    this.enableRotation = false,
    this.isCover = false,
    this.onTapUp,
    this.onTapDown,
    this.controller,
  });

  /// Conveniently loads a network image.
  factory AppPhotoView.network(
    String url, {
    Key? key,
    String? heroTag,
    dynamic minScale,
    dynamic maxScale,
    dynamic initialScale,
    BoxDecoration? backgroundDecoration,
    Widget Function(BuildContext, ImageChunkEvent?)? loadingBuilder,
    Widget Function(BuildContext, Object, StackTrace?)? errorBuilder,
    bool enableRotation = false,
    bool isCover = false,
    PhotoViewImageTapUpCallback? onTapUp,
    PhotoViewImageTapDownCallback? onTapDown,
    PhotoViewController? controller,
  }) {
    return AppPhotoView(
      key: key,
      imageProvider: NetworkImage(url),
      heroTag: heroTag,
      minScale: minScale,
      maxScale: maxScale,
      initialScale: initialScale,
      backgroundDecoration: backgroundDecoration,
      loadingBuilder: loadingBuilder,
      errorBuilder: errorBuilder,
      enableRotation: enableRotation,
      isCover: isCover,
      onTapUp: onTapUp,
      onTapDown: onTapDown,
      controller: controller,
    );
  }

  /// Conveniently loads an asset image.
  factory AppPhotoView.asset(
    String assetPath, {
    Key? key,
    String? heroTag,
    dynamic minScale,
    dynamic maxScale,
    dynamic initialScale,
    BoxDecoration? backgroundDecoration,
    Widget Function(BuildContext, ImageChunkEvent?)? loadingBuilder,
    Widget Function(BuildContext, Object, StackTrace?)? errorBuilder,
    bool enableRotation = false,
    bool isCover = false,
    PhotoViewImageTapUpCallback? onTapUp,
    PhotoViewImageTapDownCallback? onTapDown,
    PhotoViewController? controller,
  }) {
    return AppPhotoView(
      key: key,
      imageProvider: AssetImage(assetPath),
      heroTag: heroTag,
      minScale: minScale,
      maxScale: maxScale,
      initialScale: initialScale,
      backgroundDecoration: backgroundDecoration,
      loadingBuilder: loadingBuilder,
      errorBuilder: errorBuilder,
      enableRotation: enableRotation,
      isCover: isCover,
      onTapUp: onTapUp,
      onTapDown: onTapDown,
      controller: controller,
    );
  }

  /// Conveniently loads a file image.
  factory AppPhotoView.file(
    File file, {
    Key? key,
    String? heroTag,
    dynamic minScale,
    dynamic maxScale,
    dynamic initialScale,
    BoxDecoration? backgroundDecoration,
    Widget Function(BuildContext, ImageChunkEvent?)? loadingBuilder,
    Widget Function(BuildContext, Object, StackTrace?)? errorBuilder,
    bool enableRotation = false,
    bool isCover = false,
    PhotoViewImageTapUpCallback? onTapUp,
    PhotoViewImageTapDownCallback? onTapDown,
    PhotoViewController? controller,
  }) {
    return AppPhotoView(
      key: key,
      imageProvider: FileImage(file),
      heroTag: heroTag,
      minScale: minScale,
      maxScale: maxScale,
      initialScale: initialScale,
      backgroundDecoration: backgroundDecoration,
      loadingBuilder: loadingBuilder,
      errorBuilder: errorBuilder,
      enableRotation: enableRotation,
      isCover: isCover,
      onTapUp: onTapUp,
      onTapDown: onTapDown,
      controller: controller,
    );
  }

  final ImageProvider imageProvider;
  final String? heroTag;
  final dynamic minScale;
  final dynamic maxScale;
  final dynamic initialScale;
  final BoxDecoration? backgroundDecoration;
  final Widget Function(BuildContext, ImageChunkEvent?)? loadingBuilder;
  final Widget Function(BuildContext, Object, StackTrace?)? errorBuilder;
  final bool enableRotation;
  final bool isCover;
  final PhotoViewImageTapUpCallback? onTapUp;
  final PhotoViewImageTapDownCallback? onTapDown;
  final PhotoViewController? controller;

  /// Helper method to display this image viewer in a beautiful fullscreen overlay dialog/route.
  static Future<void> showFullScreen(
    BuildContext context, {
    required ImageProvider imageProvider,
    String? heroTag,
    bool enableRotation = false,
    List<ImageProvider>? galleryImages,
    int initialIndex = 0,
  }) {
    return Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierDismissible: true,
        barrierColor: Colors.black.withValues(alpha: 0.9),
        pageBuilder: (context, _, _) => AppPhotoViewFullScreenPage(
          imageProvider: imageProvider,
          heroTag: heroTag,
          enableRotation: enableRotation,
          galleryImages: galleryImages,
          initialIndex: initialIndex,
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  State<AppPhotoView> createState() => _AppPhotoViewState();
}

class _AppPhotoViewState extends State<AppPhotoView> {
  late PhotoViewController _photoViewController;
  double? _initialScale;

  @override
  void initState() {
    super.initState();
    _photoViewController = widget.controller ?? PhotoViewController();

    // Listen to scale changes to capture the initial resolved scale factor
    _photoViewController.outputStateStream.listen((value) {
      if (mounted && _initialScale == null && value.scale != null) {
        _initialScale = value.scale;
      }
    });
  }

  @override
  void dispose() {
    // Only dispose if we created it locally
    if (widget.controller == null) {
      _photoViewController.dispose();
    }
    super.dispose();
  }

  void _handleDoubleTap() {
    final scale = _photoViewController.scale ?? 1.0;
    final baseScale = _initialScale ?? 1.0;

    // Toggle between initial scale and 2.5x zoom
    if (scale > baseScale * 1.05) {
      _photoViewController.scale = baseScale;
    } else {
      _photoViewController.scale = baseScale * 2.5;
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget child = PhotoView(
      imageProvider: widget.imageProvider,
      controller: _photoViewController,
      minScale:
          widget.minScale ??
          (widget.isCover
              ? PhotoViewComputedScale.covered * 0.8
              : PhotoViewComputedScale.contained),
      maxScale:
          widget.maxScale ??
          (widget.isCover
              ? PhotoViewComputedScale.covered * 4.0
              : PhotoViewComputedScale.contained * 4.0),
      initialScale:
          widget.initialScale ??
          (widget.isCover
              ? PhotoViewComputedScale.covered
              : PhotoViewComputedScale.contained),
      backgroundDecoration:
          widget.backgroundDecoration ??
          const BoxDecoration(color: Colors.transparent),
      enableRotation: widget.enableRotation,
      loadingBuilder:
          widget.loadingBuilder ??
          (context, event) => Center(
            child: SizedBox(
              width: AppIconSize.lg,
              height: AppIconSize.lg,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                value: event == null || event.expectedTotalBytes == null
                    ? null
                    : event.cumulativeBytesLoaded / event.expectedTotalBytes!,
              ),
            ),
          ),
      errorBuilder:
          widget.errorBuilder ??
          (context, error, stackTrace) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FaIcon(
                  FontAwesomeIcons.image,
                  color: Theme.of(context).colorScheme.error,
                  size: AppIconSize.xxl,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Image Load Failed',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
                ),
              ],
            ),
          ),
      onTapUp: widget.onTapUp,
      onTapDown: widget.onTapDown,
    );

    if (widget.heroTag != null) {
      child = Hero(tag: widget.heroTag!, child: child);
    }

    return GestureDetector(onDoubleTap: _handleDoubleTap, child: child);
  }
}

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';

import '../../app_ui.dart';

class AppPhotoViewFullScreenPage extends StatefulWidget {
  const AppPhotoViewFullScreenPage({
    super.key,
    required this.imageProvider,
    this.heroTag,
    this.enableRotation = false,
    this.galleryImages,
    this.initialIndex = 0,
  });

  final ImageProvider imageProvider;
  final String? heroTag;
  final bool enableRotation;
  final List<ImageProvider>? galleryImages;
  final int initialIndex;

  @override
  State<AppPhotoViewFullScreenPage> createState() =>
      _AppPhotoViewFullScreenPageState();
}

class _AppPhotoViewFullScreenPageState
    extends State<AppPhotoViewFullScreenPage> {
  late PageController _pageController;
  late int _currentIndex;
  bool _showUI = true;
  double _dragOffset = 0;
  bool _isDragging = false;
  late PhotoViewController _photoViewController;
  double? _initialScale;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
    _photoViewController = PhotoViewController();
    _photoViewController.outputStateStream.listen((value) {
      if (mounted && _initialScale == null && value.scale != null) {
        setState(() => _initialScale = value.scale);
      }
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    _photoViewController.dispose();
    super.dispose();
  }

  bool get _canDismiss {
    final scale = _photoViewController.scale;
    if (scale == null) return true;
    final baseScale = _initialScale ?? 1.0;
    return scale <= baseScale * 1.01;
  }

  void _onVerticalDragStart(DragStartDetails details) {
    if (!_canDismiss) return;
    setState(() {
      _isDragging = true;
      _dragOffset = 0.0;
    });
  }

  void _onVerticalDragUpdate(DragUpdateDetails details) {
    if (!_isDragging) return;
    setState(() => _dragOffset += details.delta.dy);
  }

  void _onVerticalDragEnd(DragEndDetails details) {
    if (!_isDragging) return;
    final velocity = details.velocity.pixelsPerSecond.dy;
    if (_dragOffset > 120 || velocity > 400) {
      Navigator.of(context).pop();
      return;
    }
    setState(() {
      _isDragging = false;
      _dragOffset = 0.0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final galleryImages = widget.galleryImages;
    final hasGallery = galleryImages != null && galleryImages.isNotEmpty;
    final totalImages = hasGallery ? galleryImages.length : 1;
    final dragProgress = (_dragOffset.abs() / 300.0).clamp(0.0, 1.0);
    final bgOpacity = (0.95 - (dragProgress * 0.4)).clamp(0.0, 0.95);

    return Scaffold(
      backgroundColor: Colors.black.withValues(alpha: bgOpacity),
      body: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onVerticalDragStart: _onVerticalDragStart,
              onVerticalDragUpdate: _onVerticalDragUpdate,
              onVerticalDragEnd: _onVerticalDragEnd,
              onTap: () => setState(() => _showUI = !_showUI),
              child: Transform.translate(
                offset: Offset(0, _dragOffset),
                child: hasGallery
                    ? _FullscreenGallery(
                        images: galleryImages,
                        heroTag: widget.heroTag,
                        initialIndex: widget.initialIndex,
                        pageController: _pageController,
                        onPageChanged: (index) =>
                            setState(() => _currentIndex = index),
                      )
                    : _FullscreenSinglePhoto(
                        imageProvider: widget.imageProvider,
                        heroTag: widget.heroTag,
                        enableRotation: widget.enableRotation,
                        controller: _photoViewController,
                      ),
              ),
            ),
          ),
          _FullscreenTopBar(
            visible: _showUI && !_isDragging,
            hasGallery: hasGallery,
            currentIndex: _currentIndex,
            totalImages: totalImages,
          ),
        ],
      ),
    );
  }
}

class _FullscreenSinglePhoto extends StatelessWidget {
  const _FullscreenSinglePhoto({
    required this.imageProvider,
    required this.heroTag,
    required this.enableRotation,
    required this.controller,
  });

  final ImageProvider imageProvider;
  final String? heroTag;
  final bool enableRotation;
  final PhotoViewController controller;

  @override
  Widget build(BuildContext context) {
    Widget child = PhotoView(
      imageProvider: imageProvider,
      controller: controller,
      enableRotation: enableRotation,
      minScale: PhotoViewComputedScale.contained,
      maxScale: PhotoViewComputedScale.contained * 4.0,
      initialScale: PhotoViewComputedScale.contained,
      backgroundDecoration: const BoxDecoration(color: Colors.transparent),
      loadingBuilder: (context, event) =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
    );

    final tag = heroTag;
    if (tag != null) {
      child = Hero(tag: tag, child: child);
    }
    return child;
  }
}

class _FullscreenGallery extends StatelessWidget {
  const _FullscreenGallery({
    required this.images,
    required this.heroTag,
    required this.initialIndex,
    required this.pageController,
    required this.onPageChanged,
  });

  final List<ImageProvider> images;
  final String? heroTag;
  final int initialIndex;
  final PageController pageController;
  final ValueChanged<int> onPageChanged;

  @override
  Widget build(BuildContext context) {
    return PhotoViewGallery.builder(
      itemCount: images.length,
      builder: (context, index) {
        final isInitial = index == initialIndex;
        return PhotoViewGalleryPageOptions(
          imageProvider: images[index],
          heroAttributes: isInitial && heroTag != null
              ? PhotoViewHeroAttributes(tag: heroTag!)
              : null,
          minScale: PhotoViewComputedScale.contained,
          maxScale: PhotoViewComputedScale.contained * 4.0,
          initialScale: PhotoViewComputedScale.contained,
        );
      },
      pageController: pageController,
      onPageChanged: onPageChanged,
      loadingBuilder: (context, event) =>
          const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      scrollPhysics: const BouncingScrollPhysics(),
      backgroundDecoration: const BoxDecoration(color: Colors.transparent),
    );
  }
}

class _FullscreenTopBar extends StatelessWidget {
  const _FullscreenTopBar({
    required this.visible,
    required this.hasGallery,
    required this.currentIndex,
    required this.totalImages,
  });

  final bool visible;
  final bool hasGallery;
  final int currentIndex;
  final int totalImages;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: AnimatedOpacity(
        opacity: visible ? 1.0 : 0.0,
        duration: AppDurations.fast,
        child: IgnorePointer(
          ignoring: !visible,
          child: Container(
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 8,
              bottom: 16,
              left: 8,
              right: 8,
            ),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Colors.black.withValues(alpha: 0.85),
                  Colors.transparent,
                ],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const FaIcon(
                    FontAwesomeIcons.xmark,
                    color: Colors.white,
                    size: AppIconSize.xl,
                  ),
                  tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                  onPressed: () => Navigator.of(context).pop(),
                ),
                if (hasGallery) ...[
                  const SizedBox(width: AppSpacing.md),
                  Text(
                    '${currentIndex + 1} / $totalImages',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';

import '../../app_ui.dart';

final class AppCarousel extends StatefulWidget {
  const AppCarousel({
    super.key,
    required this.items,
    this.autoPlay = true,
    this.autoPlayInterval = const Duration(seconds: 4),
    this.enlargeCenterPage = true,
    this.viewportFraction = 0.85,
    this.aspectRatio = 16 / 9,
    this.showIndicators = true,
    this.onPageChanged,
    this.height,
  });

  final List<Widget> items;
  final bool autoPlay;
  final Duration autoPlayInterval;
  final bool enlargeCenterPage;
  final double viewportFraction;
  final double aspectRatio;
  final bool showIndicators;
  final ValueChanged<int>? onPageChanged;
  final double? height;

  @override
  State<AppCarousel> createState() => _AppCarouselState();
}

class _AppCarouselState extends State<AppCarousel> {
  int _current = 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CarouselSlider(
          items: widget.items,
          options: CarouselOptions(
            autoPlay: widget.autoPlay,
            autoPlayInterval: widget.autoPlayInterval,
            enlargeCenterPage: widget.enlargeCenterPage,
            viewportFraction: widget.viewportFraction,
            aspectRatio: widget.aspectRatio,
            height: widget.height,
            onPageChanged: (index, _) {
              setState(() => _current = index);
              widget.onPageChanged?.call(index);
            },
          ),
        ),
        if (widget.showIndicators && widget.items.length > 1) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.items.length, (i) {
              final isActive = i == _current;
              return AnimatedContainer(
                duration: AppDurations.medium,
                margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                width: isActive ? 24 : 8,
                height: 8,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppRadius.xs),
                  color: isActive
                      ? context.colorScheme.primary
                      : context.colorScheme.onSurface.withValues(alpha: 0.3),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}

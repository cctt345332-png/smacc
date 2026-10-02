import 'package:animated_text_kit/animated_text_kit.dart';
import 'package:flutter/material.dart';

import '../../app_ui.dart';

enum AppAnimatedTextType { typewriter, fade }

class AppAnimatedText extends StatelessWidget {
  const AppAnimatedText({
    required this.text,
    required this.type,
    super.key,
    this.textStyle,
    this.textAlign,
    this.speed = const Duration(milliseconds: 80),
    this.fadeDuration = AppDurations.xxslow,
    this.totalRepeatCount = 1,
    this.displayFullTextOnTap = true,
  });

  final String text;
  final AppAnimatedTextType type;
  final TextStyle? textStyle;
  final TextAlign? textAlign;
  final Duration speed;
  final Duration fadeDuration;
  final int totalRepeatCount;
  final bool displayFullTextOnTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedTextKit(
      animatedTexts: [
        switch (type) {
          AppAnimatedTextType.typewriter => TypewriterAnimatedText(
            text,
            textStyle: textStyle,
            textAlign: textAlign ?? TextAlign.start,
            speed: speed,
          ),
          AppAnimatedTextType.fade => FadeAnimatedText(
            text,
            textStyle: textStyle,
            textAlign: textAlign ?? TextAlign.start,
            duration: fadeDuration,
          ),
        },
      ],
      totalRepeatCount: totalRepeatCount,
      displayFullTextOnTap: displayFullTextOnTap,
    );
  }
}

import 'dart:io';
import 'dart:typed_data';

import 'package:app_ui/app_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:photo_view/photo_view.dart';
import 'package:test_utils/test_utils.dart';

void main() {
  Widget wrapWithMaterial(Widget child) {
    return MaterialApp(
      home: Scaffold(body: child),
    );
  }

  group('AppPhotoView', () {
    testWidgets('renders PhotoView with primary provider constructor', (
      tester,
    ) async {
      final imageProvider = MemoryImage(kTransparentImage);

      await tester.pumpWidget(
        wrapWithMaterial(AppPhotoView(imageProvider: imageProvider)),
      );

      // Verify PhotoView is rendered
      expect(find.byType(PhotoView), findsOneWidget);
    });

    testWidgets('factory constructors create AppPhotoView without errors', (
      tester,
    ) async {
      // Test Asset factory constructor
      final assetWidget = AppPhotoView.asset('assets/icons/app_icon.png');
      expect(assetWidget.imageProvider, isA<AssetImage>());

      // Test Network factory constructor
      final networkWidget = AppPhotoView.network(
        'https://example.com/image.png',
      );
      expect(networkWidget.imageProvider, isA<NetworkImage>());

      // Test File factory constructor
      final fileWidget = AppPhotoView.file(File('image.png'));
      expect(fileWidget.imageProvider, isA<FileImage>());
    });

    testWidgets('renders error builder when image load fails', (tester) async {
      // MemoryImage with invalid bytes triggers an error
      final imageProvider = MemoryImage(Uint8List.fromList([0, 1, 2]));

      await tester.pumpWidget(
        wrapWithMaterial(AppPhotoView(imageProvider: imageProvider)),
      );
      await tester.pump();

      // Let the image loading fail and trigger state change
      await tester.pump(const Duration(milliseconds: 100));

      // Verify the error text is displayed
      expect(find.text('Image Load Failed'), findsOneWidget);
      expect(
        find.byWidgetPredicate(
          (w) =>
              w is FaIcon &&
              w.icon?.codePoint == FontAwesomeIcons.image.codePoint,
        ),
        findsOneWidget,
      );
    });

    testWidgets('shows fullscreen viewer and close button dismisses it', (
      tester,
    ) async {
      final imageProvider = MemoryImage(kTransparentImage);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () {
                  AppPhotoView.showFullScreen(
                    context,
                    imageProvider: imageProvider,
                    heroTag: 'test_tag',
                  );
                },
                child: const Text('Open Viewer'),
              );
            },
          ),
        ),
      );

      // Open fullscreen viewer
      await tester.tap(find.text('Open Viewer'));
      await tester.pumpAndSettle();

      // Screen should transition to showing PhotoView inside the full screen page
      expect(find.byType(PhotoView), findsOneWidget);

      // Close button should be present
      final closeButton = find.byWidgetPredicate(
        (w) =>
            w is FaIcon &&
            w.icon?.codePoint == FontAwesomeIcons.xmark.codePoint,
      );
      expect(closeButton, findsOneWidget);

      // Tap close to dismiss
      await tester.tap(closeButton);
      await tester.pumpAndSettle();

      // Full screen viewer should be closed
      expect(find.byType(PhotoView), findsNothing);
    });

    testWidgets('fullscreen viewer drag-to-dismiss works', (tester) async {
      final imageProvider = MemoryImage(kTransparentImage);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              return ElevatedButton(
                onPressed: () {
                  AppPhotoView.showFullScreen(
                    context,
                    imageProvider: imageProvider,
                  );
                },
                child: const Text('Open Viewer'),
              );
            },
          ),
        ),
      );

      // Open fullscreen viewer
      await tester.tap(find.text('Open Viewer'));
      await tester.pumpAndSettle();

      expect(find.byType(PhotoView), findsOneWidget);

      // Drag down vertically to dismiss
      await tester.drag(find.byType(PhotoView), const Offset(0, 300));
      await tester.pumpAndSettle();

      // Full screen viewer should be closed via drag
      expect(find.byType(PhotoView), findsNothing);
    });
  });
}

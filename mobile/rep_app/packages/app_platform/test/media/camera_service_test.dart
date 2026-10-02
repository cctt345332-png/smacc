import 'package:app_platform/app_platform.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:test_utils/test_utils.dart';

class MockCameraController extends Mock implements CameraController {}

class FakeCameraDescription extends Fake implements CameraDescription {}

void main() {
  group('CameraService', () {
    late MockCameraController mockController;
    late CameraService cameraService;
    late CameraDescription fakeDescription;

    setUp(() {
      mockController = MockCameraController();
      fakeDescription = FakeCameraDescription();

      // Register fallback values for mocktail
      registerFallbackValue(fakeDescription);
      registerFallbackValue(ResolutionPreset.medium);
      registerFallbackValue(FlashMode.off);
      registerFallbackValue(ExposureMode.auto);
      registerFallbackValue(FocusMode.auto);
      registerFallbackValue(VideoStabilizationMode.off);
    });

    test('getAvailableCameras delegates correctly', () async {
      cameraService = CameraService.custom(
        () async => [fakeDescription],
        ({
          required description,
          required resolutionPreset,
          enableAudio = true,
          imageFormatGroup,
        }) => mockController,
      );

      final cameras = await cameraService.getAvailableCameras();
      expect(cameras, equals([fakeDescription]));
    });

    test('initialize creates a new controller and initializes it', () async {
      cameraService = CameraService.custom(
        () async => [fakeDescription],
        ({
          required description,
          required resolutionPreset,
          enableAudio = true,
          imageFormatGroup,
        }) {
          return mockController;
        },
      );

      var isInitialized = false;
      when(() => mockController.value).thenAnswer(
        (_) => CameraValue(
          isInitialized: isInitialized,
          errorDescription: null,
          previewSize: null,
          isRecordingVideo: false,
          isTakingPicture: false,
          isStreamingImages: false,
          isRecordingPaused: false,
          flashMode: FlashMode.off,
          exposureMode: ExposureMode.auto,
          focusMode: FocusMode.auto,
          exposurePointSupported: false,
          focusPointSupported: false,
          deviceOrientation: DeviceOrientation.portraitUp,
          description: fakeDescription,
        ),
      );

      when(() => mockController.initialize()).thenAnswer((_) async {
        isInitialized = true;
      });

      expect(cameraService.controller, isNull);
      expect(cameraService.isInitialized, isFalse);

      await cameraService.initialize(description: fakeDescription);

      expect(cameraService.controller, mockController);
      expect(cameraService.isInitialized, isTrue);
      verify(() => mockController.initialize()).called(1);
    });

    test('dispose calls dispose on controller if initialized', () async {
      cameraService = CameraService.custom(
        () async => [fakeDescription],
        ({
          required description,
          required resolutionPreset,
          enableAudio = true,
          imageFormatGroup,
        }) => mockController,
      );

      when(() => mockController.value).thenReturn(
        CameraValue(
          isInitialized: true,
          errorDescription: null,
          previewSize: null,
          isRecordingVideo: false,
          isTakingPicture: false,
          isStreamingImages: false,
          isRecordingPaused: false,
          flashMode: FlashMode.off,
          exposureMode: ExposureMode.auto,
          focusMode: FocusMode.auto,
          exposurePointSupported: false,
          focusPointSupported: false,
          deviceOrientation: DeviceOrientation.portraitUp,
          description: fakeDescription,
        ),
      );

      when(() => mockController.initialize()).thenAnswer((_) async {});
      when(() => mockController.dispose()).thenAnswer((_) async {});

      await cameraService.initialize(description: fakeDescription);
      expect(cameraService.controller, mockController);

      await cameraService.dispose();
      expect(cameraService.controller, isNull);
      verify(() => mockController.dispose()).called(1);
    });

    test(
      'throws CameraNotInitializedException when calling operations before initialize',
      () async {
        cameraService = CameraService.custom(
          () async => [fakeDescription],
          ({
            required description,
            required resolutionPreset,
            enableAudio = true,
            imageFormatGroup,
          }) => mockController,
        );

        expect(
          () => cameraService.takePicture(),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.startVideoRecording(),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.stopVideoRecording(),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.pauseVideoRecording(),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.resumeVideoRecording(),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.setFlashMode(FlashMode.torch),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.setZoomLevel(2),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.getMinZoomLevel(),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.getMaxZoomLevel(),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.setExposureMode(ExposureMode.locked),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.setExposureOffset(0.5),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.setFocusMode(FocusMode.locked),
          throwsA(isA<CameraNotInitializedException>()),
        );
        expect(
          () => cameraService.setVideoStabilizationMode(
            VideoStabilizationMode.level1,
          ),
          throwsA(isA<CameraNotInitializedException>()),
        );
      },
    );

    test('delegates operations to controller when initialized', () async {
      cameraService = CameraService.custom(
        () async => [fakeDescription],
        ({
          required description,
          required resolutionPreset,
          enableAudio = true,
          imageFormatGroup,
        }) => mockController,
      );

      when(() => mockController.value).thenReturn(
        CameraValue(
          isInitialized: true,
          errorDescription: null,
          previewSize: const Size(1280, 720),
          isRecordingVideo: true,
          isTakingPicture: false,
          isStreamingImages: false,
          isRecordingPaused: false,
          flashMode: FlashMode.torch,
          exposureMode: ExposureMode.locked,
          focusMode: FocusMode.locked,
          exposurePointSupported: true,
          focusPointSupported: true,
          deviceOrientation: DeviceOrientation.portraitUp,
          description: fakeDescription,
        ),
      );

      when(() => mockController.initialize()).thenAnswer((_) async {});
      await cameraService.initialize(description: fakeDescription);

      expect(cameraService.isRecordingVideo, isTrue);

      final fakeFile = XFile('path/to/file');

      when(
        () => mockController.takePicture(),
      ).thenAnswer((_) async => fakeFile);
      final picture = await cameraService.takePicture();
      expect(picture, fakeFile);
      verify(() => mockController.takePicture()).called(1);

      when(() => mockController.startVideoRecording()).thenAnswer((_) async {});
      await cameraService.startVideoRecording();
      verify(() => mockController.startVideoRecording()).called(1);

      when(
        () => mockController.stopVideoRecording(),
      ).thenAnswer((_) async => fakeFile);
      final video = await cameraService.stopVideoRecording();
      expect(video, fakeFile);
      verify(() => mockController.stopVideoRecording()).called(1);

      when(() => mockController.pauseVideoRecording()).thenAnswer((_) async {});
      await cameraService.pauseVideoRecording();
      verify(() => mockController.pauseVideoRecording()).called(1);

      when(
        () => mockController.resumeVideoRecording(),
      ).thenAnswer((_) async {});
      await cameraService.resumeVideoRecording();
      verify(() => mockController.resumeVideoRecording()).called(1);

      when(
        () => mockController.setFlashMode(FlashMode.torch),
      ).thenAnswer((_) async {});
      await cameraService.setFlashMode(FlashMode.torch);
      verify(() => mockController.setFlashMode(FlashMode.torch)).called(1);

      when(() => mockController.setZoomLevel(2)).thenAnswer((_) async {});
      await cameraService.setZoomLevel(2);
      verify(() => mockController.setZoomLevel(2)).called(1);

      when(() => mockController.getMinZoomLevel()).thenAnswer((_) async => 1.0);
      final minZoom = await cameraService.getMinZoomLevel();
      expect(minZoom, 1.0);
      verify(() => mockController.getMinZoomLevel()).called(1);

      when(() => mockController.getMaxZoomLevel()).thenAnswer((_) async => 8.0);
      final maxZoom = await cameraService.getMaxZoomLevel();
      expect(maxZoom, 8.0);
      verify(() => mockController.getMaxZoomLevel()).called(1);

      when(
        () => mockController.setExposureMode(ExposureMode.locked),
      ).thenAnswer((_) async {});
      await cameraService.setExposureMode(ExposureMode.locked);
      verify(
        () => mockController.setExposureMode(ExposureMode.locked),
      ).called(1);

      when(
        () => mockController.setExposureOffset(0.5),
      ).thenAnswer((_) async => 0.5);
      await cameraService.setExposureOffset(0.5);
      verify(() => mockController.setExposureOffset(0.5)).called(1);

      when(
        () => mockController.setFocusMode(FocusMode.locked),
      ).thenAnswer((_) async {});
      await cameraService.setFocusMode(FocusMode.locked);
      verify(() => mockController.setFocusMode(FocusMode.locked)).called(1);

      when(
        () => mockController.setVideoStabilizationMode(
          VideoStabilizationMode.level1,
        ),
      ).thenAnswer((_) async {});
      await cameraService.setVideoStabilizationMode(
        VideoStabilizationMode.level1,
      );
      verify(
        () => mockController.setVideoStabilizationMode(
          VideoStabilizationMode.level1,
        ),
      ).called(1);
    });
  });
}

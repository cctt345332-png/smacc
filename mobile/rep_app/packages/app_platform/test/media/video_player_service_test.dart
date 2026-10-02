import 'dart:io';
import 'package:app_platform/app_platform.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:test_utils/test_utils.dart';

class MockVideoPlayerController extends Mock implements VideoPlayerController {}

void main() {
  // Required since VideoPlayerController uses MethodChannels internally
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppVideoPlayerControllerImpl', () {
    late MockVideoPlayerController mockRawController;
    late AppVideoPlayerControllerImpl controller;

    setUp(() {
      mockRawController = MockVideoPlayerController();
      controller = AppVideoPlayerControllerImpl(mockRawController);
    });

    test('initialize calls rawController.initialize', () async {
      when(() => mockRawController.initialize()).thenAnswer((_) async {});
      await controller.initialize();
      verify(() => mockRawController.initialize()).called(1);
    });

    test('play calls rawController.play', () async {
      when(() => mockRawController.play()).thenAnswer((_) async {});
      await controller.play();
      verify(() => mockRawController.play()).called(1);
    });

    test('pause calls rawController.pause', () async {
      when(() => mockRawController.pause()).thenAnswer((_) async {});
      await controller.pause();
      verify(() => mockRawController.pause()).called(1);
    });

    test('seekTo calls rawController.seekTo', () async {
      const position = Duration(seconds: 5);
      when(() => mockRawController.seekTo(position)).thenAnswer((_) async {});
      await controller.seekTo(position);
      verify(() => mockRawController.seekTo(position)).called(1);
    });

    test('setVolume calls rawController.setVolume', () async {
      const volume = 0.8;
      when(() => mockRawController.setVolume(volume)).thenAnswer((_) async {});
      await controller.setVolume(volume);
      verify(() => mockRawController.setVolume(volume)).called(1);
    });

    test('setLooping calls rawController.setLooping', () async {
      const looping = true;
      when(
        () => mockRawController.setLooping(looping),
      ).thenAnswer((_) async {});
      await controller.setLooping(looping: looping);
      verify(() => mockRawController.setLooping(looping)).called(1);
    });

    test('setPlaybackSpeed calls rawController.setPlaybackSpeed', () async {
      const speed = 1.5;
      when(
        () => mockRawController.setPlaybackSpeed(speed),
      ).thenAnswer((_) async {});
      await controller.setPlaybackSpeed(speed);
      verify(() => mockRawController.setPlaybackSpeed(speed)).called(1);
    });

    test('dispose calls rawController.dispose', () async {
      when(() => mockRawController.dispose()).thenAnswer((_) async {});
      await controller.dispose();
      verify(() => mockRawController.dispose()).called(1);
    });

    test('valueListenable returns rawController', () {
      expect(controller.valueListenable, equals(mockRawController));
    });

    test('value returns rawController.value', () {
      const mockValue = VideoPlayerValue(
        duration: Duration(seconds: 10),
        isInitialized: true,
      );
      when(() => mockRawController.value).thenReturn(mockValue);
      expect(controller.value, equals(mockValue));
    });

    test('rawController returns the underlying controller', () {
      expect(controller.rawController, equals(mockRawController));
    });
  });

  group('VideoPlayerService', () {
    late VideoPlayerService service;

    setUp(() {
      service = VideoPlayerService();
    });

    test('creates controller from asset', () {
      final controller = service.asset('assets/video.mp4');
      expect(controller, isA<AppVideoPlayerController>());
      expect(controller.rawController, isNotNull);
      expect(controller.rawController!.dataSource, equals('assets/video.mp4'));
    });

    test('creates controller from network url', () {
      final uri = Uri.parse('https://example.com/video.mp4');
      final controller = service.network(uri);
      expect(controller, isA<AppVideoPlayerController>());
      expect(controller.rawController, isNotNull);
      expect(
        controller.rawController!.dataSource,
        equals('https://example.com/video.mp4'),
      );
    });

    test('creates controller from file', () {
      final file = File('video.mp4');
      final controller = service.file(file);
      expect(controller, isA<AppVideoPlayerController>());
      expect(controller.rawController, isNotNull);
      expect(
        controller.rawController!.dataSource,
        contains('video.mp4'),
      );
    });
  });
}

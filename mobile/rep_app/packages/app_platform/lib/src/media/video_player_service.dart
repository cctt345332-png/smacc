import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';
import 'package:video_player/video_player.dart';

/// Abstract interface for video playback control.
///
/// This abstracts the `video_player` package controller, enabling easy mocking
/// and stubbing in unit and widget tests.
abstract class AppVideoPlayerController {
  /// Initializes the video controller, preparing it for playback.
  Future<void> initialize();

  /// Starts or resumes video playback.
  Future<void> play();

  /// Pauses video playback.
  Future<void> pause();

  /// Seeks to a specific position in the video timeline.
  Future<void> seekTo(Duration position);

  /// Sets the audio volume (0.0 to 1.0).
  Future<void> setVolume(double volume);

  /// Configures whether the video should loop upon completion.
  Future<void> setLooping({required bool looping});

  /// Sets the playback speed (typically 0.5 to 2.0).
  Future<void> setPlaybackSpeed(double speed);

  /// Disposes resources held by the controller.
  Future<void> dispose();

  /// Listen to changes in the player state (position, buffering, etc.).
  ValueListenable<VideoPlayerValue> get valueListenable;

  /// The current state of the player.
  VideoPlayerValue get value;

  /// Exposes the raw underlying [VideoPlayerController] for rendering in widgets.
  VideoPlayerController? get rawController;
}

/// Concrete implementation of [AppVideoPlayerController] wrapping [VideoPlayerController].
class AppVideoPlayerControllerImpl implements AppVideoPlayerController {
  /// Creates an instance wrapping a concrete [VideoPlayerController].
  AppVideoPlayerControllerImpl(this._controller);

  final VideoPlayerController _controller;

  @override
  Future<void> initialize() => _controller.initialize();

  @override
  Future<void> play() => _controller.play();

  @override
  Future<void> pause() => _controller.pause();

  @override
  Future<void> seekTo(Duration position) => _controller.seekTo(position);

  @override
  Future<void> setVolume(double volume) => _controller.setVolume(volume);

  @override
  Future<void> setLooping({required bool looping}) =>
      _controller.setLooping(looping);

  @override
  Future<void> setPlaybackSpeed(double speed) =>
      _controller.setPlaybackSpeed(speed);

  @override
  Future<void> dispose() => _controller.dispose();

  @override
  ValueListenable<VideoPlayerValue> get valueListenable => _controller;

  @override
  VideoPlayerValue get value => _controller.value;

  @override
  VideoPlayerController get rawController => _controller;
}

/// App-level wrapper around the `video_player` package.
///
/// Exposes factory methods to create [AppVideoPlayerController] instances
/// from various data sources (asset, network URL, local file).
@lazySingleton
class VideoPlayerService {
  /// Default constructor.
  VideoPlayerService();

  /// Creates a controller from an asset path.
  AppVideoPlayerController asset(
    String dataSource, {
    String? package,
    VideoPlayerOptions? videoPlayerOptions,
  }) {
    return AppVideoPlayerControllerImpl(
      VideoPlayerController.asset(
        dataSource,
        package: package,
        videoPlayerOptions: videoPlayerOptions,
      ),
    );
  }

  /// Creates a controller from a network URL.
  AppVideoPlayerController network(
    Uri url, {
    VideoPlayerOptions? videoPlayerOptions,
    Map<String, String> httpHeaders = const <String, String>{},
  }) {
    return AppVideoPlayerControllerImpl(
      VideoPlayerController.networkUrl(
        url,
        videoPlayerOptions: videoPlayerOptions,
        httpHeaders: httpHeaders,
      ),
    );
  }

  /// Creates a controller from a local file.
  AppVideoPlayerController file(
    File file, {
    VideoPlayerOptions? videoPlayerOptions,
  }) {
    return AppVideoPlayerControllerImpl(
      VideoPlayerController.file(
        file,
        videoPlayerOptions: videoPlayerOptions,
      ),
    );
  }
}

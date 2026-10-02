import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

typedef AvailableCamerasLoader = Future<List<CameraDescription>> Function();
typedef CameraControllerFactory =
    CameraController Function({
      required CameraDescription description,
      required ResolutionPreset resolutionPreset,
      bool enableAudio,
      ImageFormatGroup? imageFormatGroup,
    });

/// Exception thrown when a camera operation is attempted before the camera is initialized.
class CameraNotInitializedException implements Exception {
  CameraNotInitializedException([this.message = 'Camera is not initialized.']);

  final String message;

  @override
  String toString() => 'CameraNotInitializedException: $message';
}

/// App-level wrapper around the `camera` package.
///
/// Encapsulates camera initialization, lifecycle management, photo/video capture,
/// and camera configuration settings (flash, zoom, stabilization).
@lazySingleton
class CameraService {
  CameraService()
    : this.custom(
        availableCameras,
        ({
          required description,
          required resolutionPreset,
          enableAudio = true,
          imageFormatGroup,
        }) => CameraController(
          description,
          resolutionPreset,
          enableAudio: enableAudio,
          imageFormatGroup: imageFormatGroup,
        ),
      );

  @visibleForTesting
  CameraService.custom(
    this._availableCameras,
    this._controllerFactory,
  );

  final AvailableCamerasLoader _availableCameras;
  final CameraControllerFactory _controllerFactory;

  CameraController? _controller;

  /// Exposes the active [CameraController] instance.
  ///
  /// Returns `null` if the camera is not initialized.
  CameraController? get controller => _controller;

  /// Returns whether the camera controller exists and is fully initialized.
  bool get isInitialized =>
      _controller != null && _controller!.value.isInitialized;

  /// Returns whether the camera is currently recording video.
  bool get isRecordingVideo =>
      _controller != null && _controller!.value.isRecordingVideo;

  /// Retrieves a list of available cameras on the device.
  Future<List<CameraDescription>> getAvailableCameras() {
    return _availableCameras();
  }

  /// Initializes a camera with the specified [description] and [resolutionPreset].
  ///
  /// If a controller was previously active, it will be automatically disposed.
  Future<void> initialize({
    required CameraDescription description,
    ResolutionPreset resolutionPreset = ResolutionPreset.medium,
    bool enableAudio = true,
    ImageFormatGroup? imageFormatGroup,
  }) async {
    await dispose();

    final controller = _controllerFactory(
      description: description,
      resolutionPreset: resolutionPreset,
      enableAudio: enableAudio,
      imageFormatGroup: imageFormatGroup,
    );

    _controller = controller;
    await controller.initialize();
  }

  /// Disposes of the active [CameraController], releasing the camera hardware resource.
  Future<void> dispose() async {
    if (_controller != null) {
      await _controller!.dispose();
      _controller = null;
    }
  }

  /// Captures an image and returns the resulting [XFile].
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<XFile> takePicture() async {
    final activeController = _ensureInitialized();
    return activeController.takePicture();
  }

  /// Starts video recording.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> startVideoRecording() async {
    final activeController = _ensureInitialized();
    await activeController.startVideoRecording();
  }

  /// Stops the current video recording and returns the captured [XFile].
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<XFile> stopVideoRecording() async {
    final activeController = _ensureInitialized();
    return activeController.stopVideoRecording();
  }

  /// Pauses the current video recording.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> pauseVideoRecording() async {
    final activeController = _ensureInitialized();
    await activeController.pauseVideoRecording();
  }

  /// Resumes the current video recording.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> resumeVideoRecording() async {
    final activeController = _ensureInitialized();
    await activeController.resumeVideoRecording();
  }

  /// Updates the camera flash mode.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> setFlashMode(FlashMode mode) async {
    final activeController = _ensureInitialized();
    await activeController.setFlashMode(mode);
  }

  /// Updates the camera zoom level.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> setZoomLevel(double zoom) async {
    final activeController = _ensureInitialized();
    await activeController.setZoomLevel(zoom);
  }

  /// Retrieves the minimum zoom level supported by the camera hardware.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<double> getMinZoomLevel() async {
    final activeController = _ensureInitialized();
    return activeController.getMinZoomLevel();
  }

  /// Retrieves the maximum zoom level supported by the camera hardware.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<double> getMaxZoomLevel() async {
    final activeController = _ensureInitialized();
    return activeController.getMaxZoomLevel();
  }

  /// Configures exposure mode.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> setExposureMode(ExposureMode mode) async {
    final activeController = _ensureInitialized();
    await activeController.setExposureMode(mode);
  }

  /// Sets exposure offset.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> setExposureOffset(double offset) async {
    final activeController = _ensureInitialized();
    await activeController.setExposureOffset(offset);
  }

  /// Configures focus mode.
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> setFocusMode(FocusMode mode) async {
    final activeController = _ensureInitialized();
    await activeController.setFocusMode(mode);
  }

  /// Sets video stabilization mode (added in camera version 0.12.0).
  ///
  /// Throws a [CameraNotInitializedException] if the controller is not initialized.
  Future<void> setVideoStabilizationMode(VideoStabilizationMode mode) async {
    final activeController = _ensureInitialized();
    await activeController.setVideoStabilizationMode(mode);
  }

  CameraController _ensureInitialized() {
    final activeController = _controller;
    if (activeController == null || !activeController.value.isInitialized) {
      throw CameraNotInitializedException();
    }
    return activeController;
  }
}

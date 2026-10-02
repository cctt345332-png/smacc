import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';
import 'package:permission_handler/permission_handler.dart';

typedef PermissionStatusLoader = Future<PermissionStatus> Function();
typedef PermissionRationaleLoader = Future<bool> Function();
typedef AppSettingsOpener = Future<bool> Function();

/// App-level wrapper around `permission_handler`.
///
/// Keep direct plugin calls here so feature and notification services depend on
/// app semantics instead of plugin-specific APIs.
@lazySingleton
class PermissionService {
  PermissionService()
    : this.custom(
        () => Permission.notification.status,
        () => Permission.notification.request(),
        () => Permission.notification.shouldShowRequestRationale,
        openAppSettings,
        cameraStatus: () => Permission.camera.status,
        requestCamera: () => Permission.camera.request(),
        cameraRationale: () => Permission.camera.shouldShowRequestRationale,
        galleryStatus: () => Permission.photos.status,
        requestGallery: () => Permission.photos.request(),
        galleryRationale: () => Permission.photos.shouldShowRequestRationale,
      );

  @visibleForTesting
  PermissionService.custom(
    this._notificationStatus,
    this._requestNotification,
    this._notificationRationale,
    this._openSettings, {
    PermissionStatusLoader? cameraStatus,
    PermissionStatusLoader? requestCamera,
    PermissionRationaleLoader? cameraRationale,
    PermissionStatusLoader? galleryStatus,
    PermissionStatusLoader? requestGallery,
    PermissionRationaleLoader? galleryRationale,
  }) : _cameraStatus =
           cameraStatus ?? (() => Future.value(PermissionStatus.denied)),
       _requestCamera =
           requestCamera ?? (() => Future.value(PermissionStatus.denied)),
       _cameraRationale = cameraRationale ?? (() => Future.value(false)),
       _galleryStatus =
           galleryStatus ?? (() => Future.value(PermissionStatus.denied)),
       _requestGallery =
           requestGallery ?? (() => Future.value(PermissionStatus.denied)),
       _galleryRationale = galleryRationale ?? (() => Future.value(false));

  final PermissionStatusLoader _notificationStatus;
  final PermissionStatusLoader _requestNotification;
  final PermissionRationaleLoader _notificationRationale;
  final PermissionStatusLoader _cameraStatus;
  final PermissionStatusLoader _requestCamera;
  final PermissionRationaleLoader _cameraRationale;
  final PermissionStatusLoader _galleryStatus;
  final PermissionStatusLoader _requestGallery;
  final PermissionRationaleLoader _galleryRationale;
  final AppSettingsOpener _openSettings;

  Future<PermissionStatus> notificationStatus() {
    if (kIsWeb) return Future.value(PermissionStatus.denied);
    return _notificationStatus();
  }

  Future<bool> hasNotificationPermission() async {
    return isNotificationAllowed(await notificationStatus());
  }

  Future<PermissionStatus> requestNotificationStatus() {
    if (kIsWeb) return Future.value(PermissionStatus.denied);
    return _requestNotification();
  }

  Future<bool> requestNotificationPermission() async {
    return isNotificationAllowed(await requestNotificationStatus());
  }

  Future<bool> shouldShowNotificationPermissionRationale() {
    if (kIsWeb) return Future.value(false);
    return _notificationRationale();
  }

  Future<PermissionStatus> cameraStatus() {
    if (kIsWeb) return Future.value(PermissionStatus.denied);
    return _cameraStatus();
  }

  Future<bool> hasCameraPermission() async {
    return isCameraAllowed(await cameraStatus());
  }

  Future<PermissionStatus> requestCameraStatus() {
    if (kIsWeb) return Future.value(PermissionStatus.denied);
    return _requestCamera();
  }

  Future<bool> requestCameraPermission() async {
    return isCameraAllowed(await requestCameraStatus());
  }

  Future<bool> shouldShowCameraPermissionRationale() {
    if (kIsWeb) return Future.value(false);
    return _cameraRationale();
  }

  Future<PermissionStatus> galleryStatus() {
    if (kIsWeb) return Future.value(PermissionStatus.denied);
    return _galleryStatus();
  }

  Future<bool> hasGalleryPermission() async {
    return isGalleryAllowed(await galleryStatus());
  }

  Future<PermissionStatus> requestGalleryStatus() {
    if (kIsWeb) return Future.value(PermissionStatus.denied);
    return _requestGallery();
  }

  Future<bool> requestGalleryPermission() async {
    return isGalleryAllowed(await requestGalleryStatus());
  }

  Future<bool> shouldShowGalleryPermissionRationale() {
    if (kIsWeb) return Future.value(false);
    return _galleryRationale();
  }

  Future<bool> openAppSettingsPage() {
    if (kIsWeb) return Future.value(false);
    return _openSettings();
  }

  /// iOS provisional authorization can display notifications quietly.
  bool isNotificationAllowed(PermissionStatus status) {
    return status.isGranted || status.isProvisional;
  }

  /// Whether camera permission is considered allowed (granted).
  bool isCameraAllowed(PermissionStatus status) {
    return status.isGranted;
  }

  /// Whether gallery permission is considered allowed (granted or limited).
  bool isGalleryAllowed(PermissionStatus status) {
    return status.isGranted || status.isLimited;
  }
}

import 'package:app_platform/app_platform.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PermissionService', () {
    PermissionService buildService({
      PermissionStatus status = PermissionStatus.denied,
      PermissionStatus requestStatus = PermissionStatus.denied,
      bool shouldShowRationale = false,
      bool appSettingsOpened = false,
      PermissionStatus cameraStatus = PermissionStatus.denied,
      PermissionStatus requestCameraStatus = PermissionStatus.denied,
      bool shouldShowCameraRationale = false,
      PermissionStatus galleryStatus = PermissionStatus.denied,
      PermissionStatus requestGalleryStatus = PermissionStatus.denied,
      bool shouldShowGalleryRationale = false,
    }) {
      return PermissionService.custom(
        () async => status,
        () async => requestStatus,
        () async => shouldShowRationale,
        () async => appSettingsOpened,
        cameraStatus: () async => cameraStatus,
        requestCamera: () async => requestCameraStatus,
        cameraRationale: () async => shouldShowCameraRationale,
        galleryStatus: () async => galleryStatus,
        requestGallery: () async => requestGalleryStatus,
        galleryRationale: () async => shouldShowGalleryRationale,
      );
    }

    test('treats granted and provisional notification status as allowed', () {
      final service = buildService();

      expect(service.isNotificationAllowed(PermissionStatus.granted), isTrue);
      expect(
        service.isNotificationAllowed(PermissionStatus.provisional),
        isTrue,
      );
    });

    test('treats non-notification-enabled statuses as not allowed', () {
      final service = buildService();

      for (final status in [
        PermissionStatus.denied,
        PermissionStatus.restricted,
        PermissionStatus.limited,
        PermissionStatus.permanentlyDenied,
      ]) {
        expect(service.isNotificationAllowed(status), isFalse);
      }
    });

    test('reads current notification permission status', () async {
      final service = buildService(status: PermissionStatus.granted);

      expect(await service.notificationStatus(), PermissionStatus.granted);
      expect(await service.hasNotificationPermission(), isTrue);
    });

    test(
      'requests notification permission and returns app-level allowance',
      () async {
        final service = buildService(
          requestStatus: PermissionStatus.provisional,
        );

        expect(
          await service.requestNotificationStatus(),
          PermissionStatus.provisional,
        );
        expect(await service.requestNotificationPermission(), isTrue);
      },
    );

    test('delegates rationale and settings helpers', () async {
      final service = buildService(
        shouldShowRationale: true,
        appSettingsOpened: true,
      );

      expect(await service.shouldShowNotificationPermissionRationale(), isTrue);
      expect(await service.openAppSettingsPage(), isTrue);
    });

    test('treats granted status as allowed for camera', () {
      final service = buildService();

      expect(service.isCameraAllowed(PermissionStatus.granted), isTrue);
    });

    test('treats non-granted statuses as not allowed for camera', () {
      final service = buildService();

      for (final status in [
        PermissionStatus.denied,
        PermissionStatus.restricted,
        PermissionStatus.limited,
        PermissionStatus.permanentlyDenied,
        PermissionStatus.provisional,
      ]) {
        expect(service.isCameraAllowed(status), isFalse);
      }
    });

    test('reads current camera permission status', () async {
      final service = buildService(cameraStatus: PermissionStatus.granted);

      expect(await service.cameraStatus(), PermissionStatus.granted);
      expect(await service.hasCameraPermission(), isTrue);
    });

    test(
      'requests camera permission and returns app-level allowance',
      () async {
        final service = buildService(
          requestCameraStatus: PermissionStatus.granted,
        );

        expect(await service.requestCameraStatus(), PermissionStatus.granted);
        expect(await service.requestCameraPermission(), isTrue);
      },
    );

    test('camera rationale delegates correctly', () async {
      final service = buildService(shouldShowCameraRationale: true);

      expect(await service.shouldShowCameraPermissionRationale(), isTrue);
    });

    test('treats granted and limited statuses as allowed for gallery', () {
      final service = buildService();

      expect(service.isGalleryAllowed(PermissionStatus.granted), isTrue);
      expect(service.isGalleryAllowed(PermissionStatus.limited), isTrue);
    });

    test('treats non-granted/limited statuses as not allowed for gallery', () {
      final service = buildService();

      for (final status in [
        PermissionStatus.denied,
        PermissionStatus.restricted,
        PermissionStatus.permanentlyDenied,
        PermissionStatus.provisional,
      ]) {
        expect(service.isGalleryAllowed(status), isFalse);
      }
    });

    test('reads current gallery permission status', () async {
      final service = buildService(galleryStatus: PermissionStatus.limited);

      expect(await service.galleryStatus(), PermissionStatus.limited);
      expect(await service.hasGalleryPermission(), isTrue);
    });

    test(
      'requests gallery permission and returns app-level allowance',
      () async {
        final service = buildService(
          requestGalleryStatus: PermissionStatus.granted,
        );

        expect(await service.requestGalleryStatus(), PermissionStatus.granted);
        expect(await service.requestGalleryPermission(), isTrue);
      },
    );

    test('gallery rationale delegates correctly', () async {
      final service = buildService(shouldShowGalleryRationale: true);

      expect(await service.shouldShowGalleryPermissionRationale(), isTrue);
    });
  });
}

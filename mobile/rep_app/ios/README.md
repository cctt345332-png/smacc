# iOS (`ios`)

This directory contains the complete native iOS project that embeds and runs your Flutter application on Apple devices. 

While Flutter handles most of the compilation and configuration, you will occasionally need to interact with this directory to set up native permissions, configure app signing, or manage iOS-specific dependencies (CocoaPods).

## Key Files and Directories

- **`Runner.xcworkspace`**: The main Xcode workspace. **Always open this file** in Xcode when you need to edit the iOS project natively. *Do not open `Runner.xcodeproj` directly.*
- **`Runner/Info.plist`**: The primary configuration file for the iOS app. You must edit this file to request user permissions (e.g., Camera, Photo Library, Location) by adding appropriate description strings.
- **`Runner/AppDelegate.swift`** (or `.m`): The entry point for the native iOS application. Modify this if you need to add custom native code or integrate specific plugins that require initialization before Flutter starts.
- **`Runner/Assets.xcassets`**: The asset catalog for native iOS resources. This is primarily used for setting the iOS App Icon (`AppIcon`) and the native Launch Screen images.
- **`Podfile`**: The configuration file for [CocoaPods](https://cocoapods.org/), the dependency manager for iOS. It defines the minimum iOS version and lists any native dependencies required by Flutter plugins.

## Common Tasks

### 1. Adding Permissions
Apple requires developers to provide a reason for accessing sensitive data or hardware. To add these, edit `Runner/Info.plist` (either in Xcode or via a text editor) and add the relevant keys.

```xml
<key>NSCameraUsageDescription</key>
<string>This app requires access to the camera to take photos.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>This app requires access to the photo library to upload images.</string>
```

### 2. Managing Pods
If you add a new Flutter plugin that relies on native iOS code, Flutter will automatically update the `Podfile`. Sometimes, however, you may need to manually update the pods or clear the pod cache.

Navigate to the `ios/` directory and run:
```bash
# Update local pod repos and install dependencies
pod install --repo-update

# Or, if using the Flutter CLI (recommended):
flutter clean
flutter pub get
```

### 3. Configuring App Signing and Provisioning
To deploy the app to a physical device or the App Store, you must configure code signing.
1. Open `ios/Runner.xcworkspace` in Xcode.
2. Select the `Runner` project in the Project Navigator.
3. Go to the **Signing & Capabilities** tab.
4. Select your Development Team and configure your Bundle Identifier.

## Important Note

> [!WARNING]
> While you use Xcode to configure signing and permissions, **always build and run the Flutter app using `fvm flutter run` or `fvm flutter build ipa`**. Building the project directly from Xcode without running Flutter's build steps first may result in an outdated Dart payload being packaged.

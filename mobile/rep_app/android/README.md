# Android (`android`)

This directory contains the complete native Android project that embeds and runs your Flutter application on Android devices.

While Flutter generates this directory and manages most of its configurations automatically, you occasionally need to modify files here to configure native Android features, permissions, and dependencies.

## Key Files and Directories

- **`app/`**: The main Android application module.
  - **`app/src/main/AndroidManifest.xml`**: The central configuration file for the Android app. Modify this file to add native Android permissions (e.g., camera, internet), register deep linking intent filters, or update the application name and icon.
  - **`app/src/main/kotlin/`** (or `java/`): Contains the `MainActivity` class (usually inheriting from `FlutterActivity`). You edit this if you need to write custom native Kotlin/Java code or integrate Android-specific plugins that require activity changes.
  - **`app/src/main/res/`**: Native Android resources, such as launcher icons (`mipmap` folders) and splash screens.
  - **`app/build.gradle.kts`**: The module-level Gradle build file (Kotlin DSL). Use this to change the application ID (package name), version code/name, minimum/target SDK versions, and to add Android-specific dependencies (like Firebase BOM).
- **`build.gradle.kts`** (Root): The project-level Gradle configuration. It defines the Gradle plugins and repositories used across all modules.
- **`settings.gradle.kts`**: Configures the Gradle project and includes the `app` module.
- **`gradle.properties`**: Contains project-wide Gradle properties (e.g., enabling AndroidX, allocating memory for the Gradle daemon).
- **`gradlew` / `gradlew.bat`**: The Gradle wrapper executable used to build the Android project from the command line without requiring a global Gradle installation.

## Common Tasks

### 1. Adding Permissions
To request access to device hardware or data (like the internet or location), add `<uses-permission>` tags to `app/src/main/AndroidManifest.xml`.

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Add this to allow network requests -->
    <uses-permission android:name="android.permission.INTERNET"/>
    <!-- ... -->
</manifest>
```

### 2. Updating the SDK Version
To change the `minSdkVersion`, `compileSdkVersion`, or `targetSdkVersion`, modify the `app/build.gradle.kts` file (or sometimes the `local.properties` depending on how the Flutter template is structured).

### 3. Signing the App for Release
To build a release APK or AAB, you need to configure app signing. This typically involves creating a `keystore` file and referencing it in `app/build.gradle.kts`. Refer to the [official Flutter documentation on Android deployment](https://docs.flutter.dev/deployment/android) for details.

## Important Note

> [!WARNING]
> While you can open this `android` folder in **Android Studio** to utilize native IDE features (like the visual layout editor or Gradle sync), **always build the Flutter app using `fvm flutter run` or `fvm flutter build`**. Building directly from Android Studio might bypass Flutter's compilation steps.

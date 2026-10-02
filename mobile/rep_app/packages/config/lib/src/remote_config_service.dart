import 'dart:async';

import 'package:firebase_remote_config/firebase_remote_config.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';

/// Server-controlled feature flags. Each value pairs a Remote Config key with
/// a compile-time default, so a read always returns something sensible even
/// before (or without) a successful fetch.
///
/// Replace these samples with the app's real flags; flip them in the Firebase
/// console to gate features without shipping a release.
enum FeatureFlag {
  exampleNewProfileUi(key: 'example_new_profile_ui', defaultValue: false);

  const FeatureFlag({required this.key, required this.defaultValue});

  final String key;
  final bool defaultValue;
}

/// Reads remote configuration and feature flags. Implementations must apply
/// [FeatureFlag] defaults so reads never block on the network.
abstract class RemoteConfigService {
  /// Loads defaults and triggers a fetch/activate. Safe to call once at
  /// startup; failures are swallowed so they never block app launch.
  Future<void> init();

  bool getBool(String key);
  String getString(String key);
  int getInt(String key);
  double getDouble(String key);

  /// Whether [flag] is enabled, falling back to its compile-time default.
  bool isEnabled(FeatureFlag flag);
}

@LazySingleton(as: RemoteConfigService)
class FirebaseRemoteConfigService implements RemoteConfigService {
  FirebaseRemoteConfigService(this._remoteConfig);

  final FirebaseRemoteConfig _remoteConfig;

  @override
  Future<void> init() async {
    try {
      // Settings and defaults are local and fast; await them so reads are
      // correct immediately. The network fetch is started but NOT awaited, so
      // it never blocks the first frame — remote values activate whenever the
      // fetch completes.
      await _remoteConfig.setConfigSettings(
        RemoteConfigSettings(
          fetchTimeout: const Duration(seconds: 10),
          minimumFetchInterval: const Duration(hours: 1),
        ),
      );
      await _remoteConfig.setDefaults(<String, Object>{
        for (final flag in FeatureFlag.values) flag.key: flag.defaultValue,
      });
      unawaited(_fetchAndActivate());
    } on Object catch (error) {
      _logError(error);
    }
  }

  Future<void> _fetchAndActivate() async {
    try {
      await _remoteConfig.fetchAndActivate();
    } on Object catch (error) {
      _logError(error);
    }
  }

  void _logError(Object error) {
    if (kDebugMode) {
      debugPrint('Remote Config error: $error');
    }
  }

  @override
  bool getBool(String key) => _remoteConfig.getBool(key);

  @override
  String getString(String key) => _remoteConfig.getString(key);

  @override
  int getInt(String key) => _remoteConfig.getInt(key);

  @override
  double getDouble(String key) => _remoteConfig.getDouble(key);

  @override
  bool isEnabled(FeatureFlag flag) => _remoteConfig.getBool(flag.key);
}

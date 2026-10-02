import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Wipes platform secure storage (the iOS Keychain) the first time the app
/// runs after a fresh install.
///
/// On iOS the Keychain survives app uninstalls, so secure-storage entries —
/// auth tokens — written by a previous install leak into a freshly reinstalled
/// app and present a stale, unusable session. [SharedPreferences]
/// (NSUserDefaults) *is* cleared on uninstall, so the absence of
/// [_installedFlagKey] reliably marks the first run after an install: at that
/// point we clear secure storage and set the flag, making every later launch a
/// no-op.
@lazySingleton
class KeychainResetOnReinstall {
  KeychainResetOnReinstall(this._prefs, this._secureStorage);

  final SharedPreferences _prefs;
  final FlutterSecureStorage _secureStorage;

  static const _installedFlagKey = 'app.installed';

  /// Clears secure storage if this is the first run after an install.
  ///
  /// Await this during bootstrap *before* any secure-storage read (e.g. session
  /// restore). The wipe runs before the flag is set, so a failure part-way
  /// through is retried on the next launch rather than leaving stale data
  /// behind. Safe on every platform: where an uninstall clears prefs and
  /// secure storage together (Android), the wipe is a harmless no-op on empty
  /// storage.
  Future<void> run() async {
    if (_prefs.getBool(_installedFlagKey) ?? false) return;
    await _secureStorage.deleteAll();
    await _prefs.setBool(_installedFlagKey, true);
  }
}

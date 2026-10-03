import 'package:shared_preferences/shared_preferences.dart';

import 'dart:convert';

class SessionStore {
  SessionStore(this._preferences);
  static const _tokenKey = 'masar_access_token';
  final SharedPreferences _preferences;

  String? get token => _preferences.getString(_tokenKey);
  String? get role {
    final raw = token;
    if (raw == null) return null;
    try {
      final parts = raw.split('.');
      if (parts.length < 2) return null;
      final normalized = base64Url.normalize(parts[1]);
      final payload = jsonDecode(utf8.decode(base64Url.decode(normalized)));
      return payload is Map ? payload['role']?.toString() : null;
    } catch (_) {
      return null;
    }
  }

  bool get isSupervisor => role == 'supervisor';
  Future<void> saveToken(String token) =>
      _preferences.setString(_tokenKey, token);
  Future<void> clear() => _preferences.remove(_tokenKey);
}

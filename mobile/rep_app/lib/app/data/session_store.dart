import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  SessionStore(this._preferences);
  static const _tokenKey = 'masar_access_token';
  final SharedPreferences _preferences;

  String? get token => _preferences.getString(_tokenKey);
  Future<void> saveToken(String token) => _preferences.setString(_tokenKey, token);
  Future<void> clear() => _preferences.remove(_tokenKey);
}

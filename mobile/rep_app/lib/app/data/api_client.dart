import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'session_store.dart';

class ApiException implements Exception {
  ApiException(this.message, this.statusCode);
  final String message;
  final int statusCode;
  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required this.sessionStore, http.Client? client})
    : _client = client ?? http.Client();
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.masa-erp.com/api/v1',
  );
  final SessionStore sessionStore;
  final http.Client _client;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _jsonHeaders,
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw ApiException(
        _message(data, 'تعذر تسجيل الدخول'),
        response.statusCode,
      );
    final token = data['access_token'] as String?;
    if (token == null || token.isEmpty)
      throw ApiException(
        'استجابة الخادم لا تحتوي على رمز الدخول',
        response.statusCode,
      );
    await sessionStore.saveToken(token);
    return data;
  }

  Future<Map<String, dynamic>> getMap(String path) async {
    final response = await _client.get(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
    );
    return _checked(response);
  }

  Future<List<dynamic>> getList(String path) async {
    final response = await _client.get(
      Uri.parse('$baseUrl$path'),
      headers: _headers,
    );
    final data = _checked(response);
    final value = data['data'];
    return value is List ? value : <dynamic>[];
  }

  Future<List<dynamic>> getAvailableSerials(String productId) =>
      getList('/inventory/items/$productId/available-serials');

  Future<List<dynamic>> searchSerials(String code) =>
      getList('/inventory/serials/search?q=${Uri.encodeQueryComponent(code)}');

  Future<Map<String, dynamic>> getSerial(String serialId) =>
      getMap('/inventory/serials/$serialId');

  Future<Map<String, dynamic>> post(String path, [Object? body]) async {
    final response = await _client.post(
      Uri.parse('$baseUrl$path'),
      headers: _jsonHeaders,
      body: body == null ? null : jsonEncode(body),
    );
    return _checked(response);
  }

  Future<Map<String, dynamic>> patch(String path, Object body) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl$path'),
      headers: _jsonHeaders,
      body: jsonEncode(body),
    );
    return _checked(response);
  }

  Map<String, String> get _jsonHeaders => {
    ..._headers,
    HttpHeaders.contentTypeHeader: 'application/json',
  };
  Map<String, String> get _headers => {
    HttpHeaders.acceptHeader: 'application/json',
    HttpHeaders.authorizationHeader: 'Bearer ${sessionStore.token}',
  };

  Map<String, dynamic> _checked(http.Response response) {
    if (response.statusCode == 413 || response.statusCode == 422) {
      throw ApiException(
        'حجم المرفق أو بيانات المصروف أكبر من الحد المسموح، صغّر الصورة ثم حاول مرة أخرى',
        response.statusCode,
      );
    }
    final data = _decode(response);
    if (response.statusCode == 401) {
      sessionStore.clear();
      throw ApiException(
        'انتهت الجلسة، يرجى تسجيل الدخول من جديد',
        response.statusCode,
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw ApiException(
        _message(data, 'تعذر تنفيذ الطلب'),
        response.statusCode,
      );
    return data;
  }

  Map<String, dynamic> _decode(http.Response response) {
    if (response.body.isEmpty) return <String, dynamic>{};
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      return decoded is Map<String, dynamic>
          ? decoded
          : <String, dynamic>{'data': decoded};
    } on FormatException {
      return <String, dynamic>{
        'detail': response.statusCode >= 500
            ? 'تعذر الوصول إلى الخادم، حاول مرة أخرى'
            : 'استجابة غير صالحة من الخادم (HTTP ${response.statusCode})',
      };
    }
  }

  String _message(Map<String, dynamic> data, String fallback) {
    final detail = data['detail'];
    if (detail is List)
      return detail
          .map((e) => e is Map ? e['msg'] ?? e.toString() : e.toString())
          .join('\n');
    return detail?.toString() ?? fallback;
  }
}

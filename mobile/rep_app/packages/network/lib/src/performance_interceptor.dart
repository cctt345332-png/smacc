import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_performance/firebase_performance.dart';

/// Records a Firebase Performance [HttpMetric] for each request, capturing
/// duration and response code. The metric is stashed in
/// [RequestOptions.extra] on the way out and stopped on the matching response
/// or error. Every Firebase call is guarded so monitoring can never break a
/// request.
class PerformanceInterceptor extends Interceptor {
  PerformanceInterceptor(this._performance);

  final FirebasePerformance _performance;

  static const _metricKey = '__perf_metric__';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    try {
      final metric = _performance.newHttpMetric(
        options.uri.toString(),
        _methodOf(options.method),
      );
      options.extra[_metricKey] = metric;
      unawaited(metric.start());
    } on Object {
      // Ignore: a failed metric must not affect the request.
    }
    handler.next(options);
  }

  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    _stop(response.requestOptions, response.statusCode);
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    _stop(err.requestOptions, err.response?.statusCode);
    handler.next(err);
  }

  void _stop(RequestOptions options, int? statusCode) {
    final metric = options.extra.remove(_metricKey);
    if (metric is! HttpMetric) return;
    try {
      if (statusCode != null) metric.httpResponseCode = statusCode;
      unawaited(metric.stop());
    } on Object {
      // Ignore: best-effort reporting.
    }
  }

  HttpMethod _methodOf(String method) => switch (method.toUpperCase()) {
    'GET' => HttpMethod.Get,
    'POST' => HttpMethod.Post,
    'PUT' => HttpMethod.Put,
    'DELETE' => HttpMethod.Delete,
    'PATCH' => HttpMethod.Patch,
    'HEAD' => HttpMethod.Head,
    'OPTIONS' => HttpMethod.Options,
    'TRACE' => HttpMethod.Trace,
    'CONNECT' => HttpMethod.Connect,
    _ => HttpMethod.Get,
  };
}

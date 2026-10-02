import 'package:flutter_test/flutter_test.dart';
import 'package:network/network.dart';
import 'package:test_utils/test_utils.dart';

class _MockPerformance extends Mock implements FirebasePerformance {}

class _MockHttpMetric extends Mock implements HttpMetric {}

/// Returns a fixed response or throws a fixed error for any request.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.outcome);

  final Object outcome;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final result = outcome;
    if (result is DioException) throw result;
    return result as ResponseBody;
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUpAll(() => registerFallbackValue(HttpMethod.Get));

  late _MockPerformance performance;
  late _MockHttpMetric metric;

  setUp(() {
    performance = _MockPerformance();
    metric = _MockHttpMetric();
    when(() => performance.newHttpMetric(any(), any())).thenReturn(metric);
    when(metric.start).thenAnswer((_) async {});
    when(metric.stop).thenAnswer((_) async {});
    when(() => metric.httpResponseCode = any()).thenReturn(null);
  });

  Dio buildDio(Object outcome) {
    return Dio(BaseOptions(baseUrl: 'https://example.test'))
      ..httpClientAdapter = _StubAdapter(outcome)
      ..interceptors.add(PerformanceInterceptor(performance));
  }

  ResponseBody ok() => ResponseBody.fromString('{}', 200);

  test('starts and stops a metric with the response code on success', () async {
    final dio = buildDio(ok());

    await dio.get<dynamic>('/thing');

    verify(() => performance.newHttpMetric(any(), HttpMethod.Get)).called(1);
    verify(metric.start).called(1);
    verify(() => metric.httpResponseCode = 200).called(1);
    verify(metric.stop).called(1);
  });

  test('stops the metric with the status code on error', () async {
    // A 500 response: Dio's default validateStatus rejects it and raises a
    // DioException carrying the original request options (and our metric).
    final dio = buildDio(ResponseBody.fromString('{}', 500));

    await expectLater(dio.get<dynamic>('/thing'), throwsA(isA<DioException>()));

    verify(metric.start).called(1);
    verify(() => metric.httpResponseCode = 500).called(1);
    verify(metric.stop).called(1);
  });
}

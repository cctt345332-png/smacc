import 'dart:async';

import 'package:architecture/architecture.dart';
import 'package:test/test.dart';

void main() {
  group('UseCase', () {
    const useCase = _TestUseCase();

    test('passes params through call and returns Ok', () async {
      final result = await useCase('abc');

      switch (result) {
        case Ok(:final value):
          expect(value, 3);
        case Err():
          fail('Expected Ok');
      }
    });

    test('runGuarded returns Ok for async operation', () async {
      final result = await useCase.guard(() async => 42);

      expect(result, isA<Ok<int>>());
      expect((result as Ok<int>).value, 42);
    });

    test('runGuarded maps thrown Failure to Err unchanged', () async {
      const failure = ValidationFailure('Invalid value');

      // We throw a Failure model directly in this test case to verify that the
      // guard mechanism correctly traps it and handles it as a Failure.
      // ignore: only_throw_errors
      final result = await useCase.guard(() => throw failure);

      expect(result, isA<Err<int>>());
      expect((result as Err<int>).failure, same(failure));
    });

    test('runGuarded maps unknown exceptions to UnknownFailure', () async {
      final result = await useCase.guard(() => throw StateError('boom'));

      expect(result, isA<Err<int>>());
      final failure = (result as Err<int>).failure;
      expect(failure, isA<UnknownFailure>());
      expect(failure.message, contains('boom'));
    });

    test('runGuarded supports custom failure mapping', () async {
      final result = await useCase.guard(
        () => throw StateError('boom'),
        mapFailure: (_, _) => const ValidationFailure('Mapped'),
      );

      expect(result, isA<Err<int>>());
      final failure = (result as Err<int>).failure;
      expect(failure, isA<ValidationFailure>());
      expect(failure.message, 'Mapped');
    });

    test('runResultGuarded returns existing Result', () async {
      final result = await useCase.guardResult(() => const Ok(7));

      expect(result, isA<Ok<int>>());
      expect((result as Ok<int>).value, 7);
    });

    test('runResultGuarded maps thrown exceptions to Err', () async {
      final result = await useCase.guardResult(() => throw Exception('boom'));

      expect(result, isA<Err<int>>());
      expect((result as Err<int>).failure, isA<UnknownFailure>());
    });
  });

  group('NoParams', () {
    test('provides a reusable no-argument marker', () {
      expect(noParams, isA<NoParams>());
    });

    test('NoParamUseCase can be called without params', () async {
      const useCase = _TestNoParamUseCase();

      final result = await useCase();

      expect(result, isA<Ok<int>>());
      expect((result as Ok<int>).value, 1);
    });
  });
}

class _TestUseCase extends UseCase<String, int> {
  const _TestUseCase();

  @override
  Future<Result<int>> call(String param) {
    return runGuarded(() => param.length);
  }

  Future<Result<int>> guard(
    FutureOr<int> Function() operation, {
    FailureMapper? mapFailure,
  }) {
    return runGuarded(operation, mapFailure: mapFailure);
  }

  Future<Result<int>> guardResult(
    FutureOr<Result<int>> Function() operation, {
    FailureMapper? mapFailure,
  }) {
    return runResultGuarded(operation, mapFailure: mapFailure);
  }
}

class _TestNoParamUseCase extends NoParamUseCase<int> {
  const _TestNoParamUseCase();

  @override
  Future<Result<int>> call([NoParams param = noParams]) {
    return runGuarded(() => 1);
  }
}

import 'package:architecture/architecture.dart';
import 'package:test/test.dart';

void main() {
  group('Ok', () {
    test('holds the provided value', () {
      const result = Ok(42);
      expect(result.value, 42);
    });

    test('supports null value', () {
      const result = Ok<int?>(null);
      expect(result.value, isNull);
    });

    test('supports string value', () {
      const result = Ok('hello');
      expect(result.value, 'hello');
    });
  });

  group('Err', () {
    test('holds the provided failure', () {
      const failure = UnknownFailure('something broke');
      const result = Err<int>(failure);
      expect(result.failure, same(failure));
    });

    test('holds InvalidCredentialsFailure', () {
      const failure = InvalidCredentialsFailure();
      const result = Err<String>(failure);
      expect(result.failure.message, 'Invalid credentials');
    });
  });

  group('Result exhaustiveness', () {
    test('Ok is Result', () {
      const result = Ok(1);
      expect(result, isA<Result<int>>());
    });

    test('Err is Result', () {
      const result = Err<int>(UnknownFailure());
      expect(result, isA<Result<int>>());
    });

    test('pattern matching on Result', () {
      const Result<int> result = Ok(10);
      final value = switch (result) {
        Ok(:final value) => value,
        Err<int> _ => -1,
      };
      expect(value, 10);
    });

    test('pattern matching on Err', () {
      const Result<int> result = Err<int>(UnknownFailure());
      final value = switch (result) {
        Ok(:final value) => value,
        Err<int> _ => -1,
      };
      expect(value, -1);
    });
  });
}

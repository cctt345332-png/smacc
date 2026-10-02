import 'failure.dart';

/// Discriminated union representing either a success value or a [Failure].
/// Use exhaustive pattern matching at call sites - no `null` sentinels.
sealed class Result<T> {
  const Result();
}

final class Ok<T> extends Result<T> {
  const Ok(this.value);
  final T value;
}

final class Err<T> extends Result<T> {
  const Err(this.failure);
  final Failure failure;
}

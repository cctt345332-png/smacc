import 'dart:async';

import 'failure.dart';
import 'result.dart';

typedef FailureMapper = Failure Function(Object error, StackTrace stackTrace);

/// Marker parameter for use cases that do not need input.
final class NoParams {
  const NoParams();
}

const noParams = NoParams();

/// Base contract for domain use cases.
///
/// [Param] is the input object and [Output] is the success value wrapped in a
/// [Result].
abstract class UseCase<Param, Output> {
  const UseCase();

  Future<Result<Output>> call(Param param);

  Future<Result<Output>> runGuarded(
    FutureOr<Output> Function() operation, {
    FailureMapper? mapFailure,
  }) async {
    try {
      final value = await Future<Output>.sync(operation);
      return Ok(value);
    } on Object catch (error, stackTrace) {
      final mapper = mapFailure ?? defaultUseCaseFailureMapper;
      return Err(mapper(error, stackTrace));
    }
  }

  Future<Result<Output>> runResultGuarded(
    FutureOr<Result<Output>> Function() operation, {
    FailureMapper? mapFailure,
  }) async {
    try {
      return await Future<Result<Output>>.sync(operation);
    } on Object catch (error, stackTrace) {
      final mapper = mapFailure ?? defaultUseCaseFailureMapper;
      return Err(mapper(error, stackTrace));
    }
  }
}

abstract class NoParamUseCase<Output> extends UseCase<NoParams, Output> {
  const NoParamUseCase();

  @override
  Future<Result<Output>> call([NoParams param = noParams]);
}

Failure defaultUseCaseFailureMapper(Object error, StackTrace stackTrace) {
  if (error is Failure) return error;

  return UnknownFailure(error.toString());
}

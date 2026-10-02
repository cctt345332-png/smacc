import 'result.dart' show Result;

/// Base type for domain-layer failures returned from repositories and use
/// cases. Subclass per feature; never throw these - return them via [Result].
sealed class Failure {
  const Failure(this.message);

  final String message;
}

class UnknownFailure extends Failure {
  const UnknownFailure([super.message = 'Unknown error']);
}

/// Expected absence of a persisted session - not an error.
/// Use to distinguish "user never signed in" from real restore failures.
class NoSessionFailure extends Failure {
  const NoSessionFailure([super.message = 'No persisted session']);
}

class InvalidCredentialsFailure extends Failure {
  const InvalidCredentialsFailure([super.message = 'Invalid credentials']);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Not found']);
}

class ValidationFailure extends Failure {
  const ValidationFailure([super.message = 'Invalid input']);
}

class PermissionFailure extends Failure {
  const PermissionFailure([super.message = 'Permission denied']);
}

class CameraPermissionFailure extends PermissionFailure {
  const CameraPermissionFailure([super.message = 'Camera permission denied']);
}

class MediaPickFailure extends Failure {
  const MediaPickFailure([super.message = 'Failed to pick media']);
}

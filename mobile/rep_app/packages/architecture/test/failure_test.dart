import 'package:architecture/architecture.dart';
import 'package:test/test.dart';

void main() {
  group('Failure', () {
    group('UnknownFailure', () {
      test('uses default message when none provided', () {
        const f = UnknownFailure();
        expect(f.message, 'Unknown error');
      });

      test('uses custom message when provided', () {
        const f = UnknownFailure('Custom');
        expect(f.message, 'Custom');
      });
    });

    group('InvalidCredentialsFailure', () {
      test('uses default message when none provided', () {
        const f = InvalidCredentialsFailure();
        expect(f.message, 'Invalid credentials');
      });

      test('uses custom message when provided', () {
        const f = InvalidCredentialsFailure('Bad password');
        expect(f.message, 'Bad password');
      });
    });

    group('NotFoundFailure', () {
      test('uses default message when none provided', () {
        const f = NotFoundFailure();
        expect(f.message, 'Not found');
      });

      test('uses custom message when provided', () {
        const f = NotFoundFailure('Bookmark not found');
        expect(f.message, 'Bookmark not found');
      });
    });

    group('ValidationFailure', () {
      test('uses default message when none provided', () {
        const f = ValidationFailure();
        expect(f.message, 'Invalid input');
      });

      test('uses custom message when provided', () {
        const f = ValidationFailure('Title is required');
        expect(f.message, 'Title is required');
      });
    });
  });
}

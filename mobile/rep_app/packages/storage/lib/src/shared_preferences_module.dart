import 'package:injectable/injectable.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Provides the app-wide [SharedPreferences] instance to the DI graph.
///
/// `@preResolve` makes `configureDependencies()` await the async
/// `getInstance()` so consumers can take a ready instance synchronously.
@module
abstract class SharedPreferencesModule {
  @preResolve
  Future<SharedPreferences> provideSharedPreferences() =>
      SharedPreferences.getInstance();
}

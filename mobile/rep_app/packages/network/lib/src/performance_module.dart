import 'package:firebase_performance/firebase_performance.dart';
import 'package:injectable/injectable.dart';

@module
abstract class PerformanceModule {
  @lazySingleton
  FirebasePerformance providePerformance() => FirebasePerformance.instance;
}

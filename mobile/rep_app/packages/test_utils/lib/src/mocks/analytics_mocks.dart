import 'package:analytics/analytics.dart';
import 'package:mocktail/mocktail.dart';

class MockAnalyticsService extends Mock implements AnalyticsService {}

void stubAnalyticsService(MockAnalyticsService analytics) {
  when(
    () => analytics.logEvent(any(), parameters: any(named: 'parameters')),
  ).thenAnswer((_) async {});
  when(
    () => analytics.logLogin(method: any(named: 'method')),
  ).thenAnswer((_) async {});
  when(
    () => analytics.logSignUp(signUpMethod: any(named: 'signUpMethod')),
  ).thenAnswer((_) async {});
  when(
    () => analytics.logScreenView(screenName: any(named: 'screenName')),
  ).thenAnswer((_) async {});
  when(() => analytics.setCurrentUser(any())).thenAnswer((_) async {});
  when(
    () => analytics.setUserProperty(
      name: any(named: 'name'),
      value: any(named: 'value'),
    ),
  ).thenAnswer((_) async {});
}

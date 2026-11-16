import 'package:fitness_lifestyle/main.dart';
import 'package:fitness_lifestyle/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('catalog opens and filters back exercises', (tester) async {
    await tester.pumpWidget(const FitnessApp());
    await tester.tap(find.text('Bài tập'));
    await tester.pumpAndSettle();
    expect(find.text('Thư viện tập tại nhà'), findsOneWidget);
    await tester.tap(find.text('Lưng').hitTestable());
    await tester.pumpAndSettle();
    expect(find.text('Bird Dog'), findsOneWidget);
    expect(find.text('Squat'), findsNothing);
  });

  test('server replay fields are mapped without replacing null angles', () {
    final step = PoseStep.fromJson({
      'sequence': 7, 'phase': 'lost', 'tracking': false,
      'completedReps': 1, 'formOkReps': 1, 'partialAttempts': 0,
      'angleDegrees': null, 'feedbackCode': 'tracking_lost',
    });
    expect(step.angle, isNull);
    expect(step.completed, 1);
    expect(step.phaseLabel, 'Mất dấu');
  });
}

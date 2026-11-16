typedef Json = Map<String, Object?>;

Json objectFrom(Object? value) {
  if (value is Json) return value;
  throw const FormatException('Dữ liệu máy chủ không phải đối tượng JSON.');
}

List<Object?> arrayFrom(Object? value) {
  if (value is List<Object?>) return value;
  throw const FormatException('Dữ liệu máy chủ không phải danh sách.');
}

enum MuscleGroup {
  back('Lưng'), chest('Ngực'), arms('Tay'),
  shoulders('Vai'), legs('Chân'), abs('Bụng');

  const MuscleGroup(this.label);
  final String label;
}

class Exercise {
  const Exercise(this.name, this.group, this.equipment, this.description,
      {this.coachKey});

  final String name;
  final MuscleGroup group;
  final String equipment;
  final String description;
  final String? coachKey;
}

const exercises = <Exercise>[
  Exercise('Bird Dog', MuscleGroup.back, 'Thảm', 'Bài phối hợp tay chân ở tư thế chống bốn điểm.'),
  Exercise('Prone W Raise', MuscleGroup.back, 'Thảm', 'Nằm sấp, tập kiểm soát vùng bả vai.'),
  Exercise('Chống đẩy tường', MuscleGroup.chest, 'Tường', 'Biến thể dễ để làm quen với chuyển động đẩy.'),
  Exercise('Chống đẩy gối', MuscleGroup.chest, 'Thảm', 'Biến thể giảm tải, có thể tập tại nhà.'),
  Exercise('Cuốn tay trước', MuscleGroup.arms, 'Chai nước nhẹ', 'Tập động tác gập khuỷu với tải nhẹ.'),
  Exercise('Duỗi tay sau', MuscleGroup.arms, 'Chai nước nhẹ', 'Tập động tác duỗi khuỷu có kiểm soát.'),
  Exercise('Nâng tay ngang', MuscleGroup.shoulders, 'Không dụng cụ', 'Làm quen chuyển động nâng tay ngang.'),
  Exercise('Trượt tay trên tường', MuscleGroup.shoulders, 'Tường', 'Tập kiểm soát chuyển động vai.'),
  Exercise('Đứng lên – ngồi xuống', MuscleGroup.legs, 'Ghế chắc', 'Dùng ghế làm mốc để làm quen với bài tập chân.'),
  Exercise('Squat', MuscleGroup.legs, 'Không dụng cụ', 'Bài tập chân và hông. Có hướng dẫn bằng camera AI.', coachKey: 'squat'),
  Exercise('Nâng hông', MuscleGroup.legs, 'Thảm', 'Bài tập vùng hông và mông khi nằm ngửa.'),
  Exercise('Dead Bug', MuscleGroup.abs, 'Thảm', 'Tập kiểm soát thân người khi di chuyển tay và chân.'),
  Exercise('Plank gối', MuscleGroup.abs, 'Thảm', 'Bài giữ tư thế, theo dõi bằng thời gian.'),
  Exercise('Push-up', MuscleGroup.chest, 'Thảm', 'Chống đẩy chuẩn cho ngực và tay sau, có hướng dẫn camera.', coachKey: 'pushup'),
];

class Joint {
  const Joint(this.x, this.y, this.score);
  final double x;
  final double y;
  final double score;
  factory Joint.fromJson(Json json) => Joint(
    (json['x'] as num).toDouble(),
    (json['y'] as num).toDouble(),
    (json['score'] as num).toDouble(),
  );
}

class PoseFrame {
  const PoseFrame(this.width, this.height, this.joints);
  final int width;
  final int height;
  final Map<String, Joint> joints;
  factory PoseFrame.fromJson(Json json) => PoseFrame(
    json['width'] as int,
    json['height'] as int,
    objectFrom(json['points']).map(
      (key, value) => MapEntry(key, Joint.fromJson(objectFrom(value))),
    ),
  );
}

class PoseFixture {
  PoseFixture.fromJson(Json json)
      : title = json['title'] as String,
        exercise = json['exercise'] as String,
        rawFrames = arrayFrom(json['frames']),
        frames = arrayFrom(json['frames'])
            .map((value) => PoseFrame.fromJson(objectFrom(value))).toList(growable: false);
  final String title;
  final String exercise;
  final List<Object?> rawFrames;
  final List<PoseFrame> frames;

  Json toRequest() => {'exercise': exercise, 'frames': rawFrames};
}

class PoseStep {
  const PoseStep({
    required this.sequence, required this.phase, required this.tracking,
    required this.completed, required this.formOk, required this.partial,
    this.angle, this.feedback,
  });
  final int sequence;
  final String phase;
  final bool tracking;
  final int completed;
  final int formOk;
  final int partial;
  final double? angle;
  final String? feedback;
  factory PoseStep.fromJson(Json json) => PoseStep(
    sequence: json['sequence'] as int,
    phase: json['phase'] as String,
    tracking: json['tracking'] as bool,
    completed: json['completedReps'] as int,
    formOk: json['formOkReps'] as int,
    partial: json['partialAttempts'] as int,
    angle: (json['angleDegrees'] as num?)?.toDouble(),
    feedback: json['feedbackCode'] as String?,
  );

  String get phaseLabel => switch (phase) {
    'waiting' => 'Chờ tư thế bắt đầu',
    'ready' => 'Sẵn sàng',
    'descending' => 'Đang hạ',
    'depth' => 'Đã qua ngưỡng biên độ',
    'lost' => 'Mất dấu',
    _ => phase,
  };
  String? get feedbackLabel => switch (feedback) {
    'tracking_lost' => 'Chưa đủ điểm khớp tin cậy.',
    'review_alignment' => 'Trục thân nằm ngoài luật form thử nghiệm.',
    'incomplete_range' => 'Động tác chưa đủ biên độ để tính rep.',
    'rep_complete' => 'Đã ghi nhận một chu kỳ.',
    _ => null,
  };
}

class PoseReplay {
  const PoseReplay(this.engineVersion, this.trackedFrames, this.summary, this.timeline);
  final String engineVersion;
  final int trackedFrames;
  final PoseStep summary;
  final List<PoseStep> timeline;

  factory PoseReplay.fromJson(Json json) => PoseReplay(
    json['engineVersion'] as String,
    json['trackedFrames'] as int,
    PoseStep.fromJson(objectFrom(json['summary'])),
    arrayFrom(json['timeline']).map((value) => PoseStep.fromJson(objectFrom(value)))
        .toList(growable: false),
  );
}

class Account {
  const Account(this.username, this.token);
  final String username;
  final String token;
  factory Account.fromJson(Json json) {
    final token = json['token'];
    if (token is! String || token.trim().isEmpty) {
      throw const FormatException('Máy chủ không trả token đăng nhập.');
    }
    return Account(json['username'] as String? ?? 'Người tập', token);
  }
}

class WorkoutEntry {
  const WorkoutEntry(this.id, this.name, this.reps, this.seconds, this.date,
      {this.workoutId, this.isAnalysis = true});
  final int id;
  final String name;
  final int reps;
  final int seconds;
  final DateTime? date;
  final int? workoutId;
  final bool isAnalysis;
  factory WorkoutEntry.fromJson(Json json, {bool analysis = true}) {
    final date = json['createdAt'] ?? json['performedAt'] ?? json['date'];
    return WorkoutEntry(
      json['id'] as int,
      json['exerciseName'] as String? ?? 'Buổi tập',
      ((json['totalReps'] ?? json['reps']) as num?)?.toInt() ?? 0,
      (json['durationInSeconds'] as num?)?.round() ?? 0,
      utcDate(date),
      workoutId: json['workoutSessionId'] as int?,
      isAnalysis: analysis,
    );
  }
}

DateTime? utcDate(Object? value) {
  if (value is! String) return null;
  final zoned = RegExp(r'(Z|[+-]\d\d:\d\d)$').hasMatch(value);
  return DateTime.tryParse(zoned ? value : '${value}Z')?.toLocal();
}

class SavedWorkout {
  const SavedWorkout(this.analysisId, this.result);
  final int analysisId;
  final PoseStep result;
  factory SavedWorkout.fromJson(Json json) =>
      SavedWorkout(json['analysisId'] as int, PoseStep.fromJson(objectFrom(json['result'])));
}

class FeedPost {
  const FeedPost({
    required this.id, required this.author, required this.content, required this.isMine,
    required this.liked, required this.likeCount, required this.commentCount,
    this.createdAt, this.updatedAt, this.exerciseName, this.reps, this.durationSeconds,
  });
  final int id;
  final String author;
  final String content;
  final bool isMine;
  final bool liked;
  final int likeCount;
  final int commentCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? exerciseName;
  final int? reps;
  final int? durationSeconds;
  factory FeedPost.fromJson(Json json) => FeedPost(
    id: json['id'] as int, author: json['author'] as String, content: json['content'] as String,
    isMine: json['isMine'] == true, liked: json['liked'] == true,
    likeCount: json['likeCount'] as int, commentCount: json['commentCount'] as int,
    createdAt: utcDate(json['createdAt']), updatedAt: utcDate(json['updatedAt']),
    exerciseName: json['exerciseName'] as String?, reps: json['reps'] as int?,
    durationSeconds: (json['durationSeconds'] as num?)?.round(),
  );
}
class FeedComment {
  const FeedComment(this.id, this.author, this.content, this.isMine, this.isSuggestion);
  final int id;
  final String author;
  final String content;
  final bool isMine;
  final bool isSuggestion;
  factory FeedComment.fromJson(Json json) => FeedComment(
    json['id'] as int, json['author'] as String, json['content'] as String,
    json['isMine'] == true, json['isSuggestion'] == true,
  );
}
class PageResult<T> {
  const PageResult(this.items, this.nextBefore);
  final List<T> items;
  final int? nextBefore;
  factory PageResult.fromJson(Json json, T Function(Json) parse) => PageResult<T>(
    arrayFrom(json['items']).map((e) => parse(objectFrom(e))).toList(growable: false),
    json['nextBefore'] as int?,
  );
}

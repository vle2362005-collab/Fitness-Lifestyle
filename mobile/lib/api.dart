import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'models.dart';

class ApiException implements Exception {
  const ApiException(this.message, [this.status]);
  final String message;
  final int? status;
  @override
  String toString() => message;
}

class FitnessApi {
  FitnessApi() : _client = HttpClient()..connectionTimeout = const Duration(seconds: 5);

  static const origin = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:5088');
  final HttpClient _client;
  void Function()? onUnauthorized;

  Future<Account> login(String username, String password) async => Account.fromJson(objectFrom(
    await _request('/api/Auth/login', method: 'POST', body: {'username': username, 'password': password}),
  ));

  Future<void> register(String username, String password) async {
    await _request('/api/Auth/register', method: 'POST', body: {'username': username, 'password': password});
  }

  Future<List<WorkoutEntry>> analyses(Account account) async => arrayFrom(
    await _request('/api/WorkoutAnalysis', account: account),
  ).map((row) => WorkoutEntry.fromJson(objectFrom(row))).toList(growable: false);

  Future<List<WorkoutEntry>> history(Account account) async {
    final data = await Future.wait([
      analyses(account),
      _request('/api/Workout', account: account).then((value) => arrayFrom(value)
          .map((row) => WorkoutEntry.fromJson(objectFrom(row), analysis: false)).toList()),
    ]);
    final linked = data[0].map((e) => e.workoutId).whereType<int>().toSet();
    return [...data[0], ...data[1].where((e) => !linked.contains(e.id))]
      ..sort((a, b) => (b.date?.millisecondsSinceEpoch ?? 0).compareTo(a.date?.millisecondsSinceEpoch ?? 0));
  }

  String _name(String name) => name.toLowerCase().trim().replaceAll(RegExp(r'[- ]+'), '');
  Future<int> exerciseId(Exercise exercise) async {
    final rows = arrayFrom(await _request('/api/Exercise'));
    for (final row in rows) {
      final json = objectFrom(row);
      if (_name(json['name'] as String? ?? '') == _name(exercise.name)) return json['id'] as int;
    }
    throw const ApiException('Bài tập chưa có trong cơ sở dữ liệu. Kiểm tra đã cập nhật migration.');
  }

  Future<void> logWorkout(Exercise exercise, Account account, int minutes, int reps, int sets) async {
    final id = await exerciseId(exercise);
    await _request('/api/Workout', method: 'POST', account: account, body: {
      'exerciseId': id, 'durationMinutes': minutes, 'durationInSeconds': minutes * 60,
      'reps': reps, 'sets': sets,
    });
  }

  Future<String> startCoach(Exercise exercise, Account account) async {
    final id = await exerciseId(exercise);
    final response = await _request('/api/pose-coach/sessions', method: 'POST',
      account: account, body: {'exerciseId': id});
    return objectFrom(response)['sessionId'] as String;
  }

  Future<PoseStep?> sendFrame(String id, Account account, Json frame) async {
    final response = await _request('/api/pose-coach/sessions/$id/frames',
      method: 'POST', account: account, body: {'frames': [frame]});
    final latest = objectFrom(response)['latest'];
    return latest == null ? null : PoseStep.fromJson(objectFrom(latest));
  }

  Future<SavedWorkout> finishCoach(String id, Account account) async =>
    SavedWorkout.fromJson(objectFrom(await _request('/api/pose-coach/sessions/$id/finish',
      method: 'POST', account: account)));

  Future<void> cancelCoach(String id, Account account) async {
    await _request('/api/pose-coach/sessions/$id', method: 'DELETE', account: account);
  }

  Future<PoseReplay> replay(PoseFixture fixture, Account? account) async {
    if (account == null) throw const ApiException('Đăng nhập ở mục Tiến độ để chạy dữ liệu mẫu.');
    final result = PoseReplay.fromJson(objectFrom(await _request('/api/pose-coach/replay',
      method: 'POST', account: account, body: fixture.toRequest())));
    if (result.timeline.length != fixture.frames.length || result.timeline.isEmpty) {
      throw const FormatException('Timeline trả về không khớp chuỗi mẫu.');
    }
    return result;
  }

  Future<Json?> profile(Account account) async {
    try { return objectFrom(await _request('/api/Profile', account: account)); }
    on ApiException catch (e) { if (e.status == 404) return null; rethrow; }
  }
  Future<Json> saveProfile(Account account, Json input) async => objectFrom(objectFrom(
    await _request('/api/Profile', method: 'PUT', account: account, body: input))['profile']);
  Future<List<Json>> foods() async => arrayFrom(await _request('/api/Nutrition/foods'))
    .map(objectFrom).toList(growable: false);
  Future<Json> nutrition(Account account, String day) async =>
    objectFrom(await _request('/api/Nutrition/summary?date=$day', account: account));
  Future<void> addMeal(Account account, int foodId, double quantity, String meal, String day) async {
    await _request('/api/Nutrition', method: 'POST', account: account,
      body: {'foodId': foodId, 'quantity': quantity, 'mealType': meal, 'date': day});
  }
  Future<void> deleteMeal(Account account, int id) async {
    await _request('/api/Nutrition/$id', method: 'DELETE', account: account);
  }

  static const _feed = '/api/community/posts';
  Future<PageResult<FeedPost>> feed(Account account, {int? before}) async =>
    PageResult.fromJson(objectFrom(await _request(
      before == null ? _feed : '$_feed?before=$before', account: account)), FeedPost.fromJson);

  Future<void> writePost(Account account, String content, {int? id, int? analysisId}) async {
    await _request(id == null ? _feed : '$_feed/$id', account: account,
      method: id == null ? 'POST' : 'PUT', body: {'content': content, 'analysisId': analysisId});
  }

  Future<void> deletePost(Account account, int id) async {
    await _request('$_feed/$id', method: 'DELETE', account: account);
  }

  Future<void> toggleLike(Account account, FeedPost post) async {
    await _request('$_feed/${post.id}/like', method: post.liked ? 'DELETE' : 'PUT', account: account);
  }

  Future<PageResult<FeedComment>> comments(Account account, int postId, {int? before}) async =>
    PageResult.fromJson(objectFrom(await _request(
      '$_feed/$postId/comments${before == null ? '' : '?before=$before'}', account: account)),
      FeedComment.fromJson);

  Future<void> addComment(Account account, int postId, String content, bool suggestion) async {
    await _request('$_feed/$postId/comments', method: 'POST', account: account,
      body: {'content': content, 'isSuggestion': suggestion});
  }

  Future<void> deleteComment(Account account, int postId, int commentId) async {
    await _request('$_feed/$postId/comments/$commentId', method: 'DELETE', account: account);
  }

  Future<Object?> _request(String path, {String method = 'GET', Account? account, Json? body}) async {
    const timeout = Duration(seconds: 12);
    try {
      final base = Uri.parse(origin);
      if (base.host.isEmpty || (base.scheme != 'http' && base.scheme != 'https')) {
        throw const ApiException('Địa chỉ API cần là URL HTTP hoặc HTTPS hợp lệ.');
      }
      final request = await _client.openUrl(method, base.resolve(path)).timeout(timeout);
      request.followRedirects = false;
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      if (account != null) request.headers.set(HttpHeaders.authorizationHeader, 'Bearer ${account.token}');
      if (body != null) {
        request.headers.contentType = ContentType.json;
        request.write(jsonEncode(body));
      }
      final response = await request.close().timeout(timeout);
      final raw = await utf8.decoder.bind(response).join().timeout(timeout);
      final status = response.statusCode;
      if (status == 401 && account != null) onUnauthorized?.call();
      final success = status >= 200 && status < 300;
      final Object? data;
      try { data = raw.isEmpty ? null : jsonDecode(raw); }
      on FormatException {
        if (success) rethrow;
        throw ApiException('API trả lỗi HTTP $status.', status);
      }
      if (!success) {
        final message = data is Json ? data['message'] ?? data['error'] ?? data['title'] : null;
        throw ApiException(message is String ? message :
          status == 401 ? 'Phiên đăng nhập đã hết hạn.' : 'API trả lỗi HTTP $status.', status);
      }
      return data;
    } on SocketException {
      throw const ApiException('Chưa kết nối được API. Kiểm tra máy chủ và địa chỉ chạy app.');
    } on TimeoutException {
      throw const ApiException('Máy chủ phản hồi quá lâu. Bạn có thể thử lại.');
    } on HandshakeException {
      throw const ApiException('Không xác thực được HTTPS của máy chủ.');
    }
  }
  void close() => _client.close(force: true);
}

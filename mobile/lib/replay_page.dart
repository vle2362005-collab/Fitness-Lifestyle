import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'models.dart';

class ReplayPage extends StatefulWidget {
  const ReplayPage({super.key, required this.exercise, required this.api, this.account});
  final Exercise exercise;
  final FitnessApi api;
  final Account? account;
  @override
  State<ReplayPage> createState() => _ReplayPageState();
}

class _ReplayPageState extends State<ReplayPage> {
  late final Future<List<PoseFixture>> _fixtures;
  PoseFixture? _selected;
  PoseReplay? _result;
  String? _error;
  int _frame = 0;
  bool _busy = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _fixtures = _loadFixtures();
  }

  Future<List<PoseFixture>> _loadFixtures() async {
    final json = jsonDecode(await rootBundle.loadString('assets/pose_fixtures.json'));
    return arrayFrom(json).map((e) => PoseFixture.fromJson(objectFrom(e)))
        .where((e) => e.exercise == widget.exercise.coachKey).toList(growable: false);
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _run(PoseFixture fixture) async {
    _timer?.cancel();
    setState(() {
      _timer = null;
      _frame = 0;
      _busy = true;
      _error = null;
      _result = null;
    });
    try {
      final result = await widget.api.replay(fixture, widget.account);
      if (!mounted) return;
      setState(() {
        _result = result;
        _frame = result.timeline.length - 1;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error is ApiException ? error.message : 'Không đọc được dữ liệu phản hồi.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _play(int frameCount) {
    if (_timer != null) {
      _timer?.cancel();
      setState(() => _timer = null);
      return;
    }
    setState(() => _frame = 0);
    _timer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      if (_frame + 1 >= frameCount) {
        timer.cancel();
        setState(() => _timer = null);
      } else {
        setState(() => _frame++);
      }
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('AI Coach · ${widget.exercise.name}')),
    body: FutureBuilder<List<PoseFixture>>(
      future: _fixtures,
      builder: (context, snapshot) {
        if (snapshot.hasError) return const Center(child: Text('Không đọc được dữ liệu mẫu.'));
        final fixtures = snapshot.data;
        if (fixtures == null) return const Center(child: CircularProgressIndicator());
        if (fixtures.isEmpty) return const Center(child: Text('Chưa có ca phát lại cho bài này.'));
        final fixture = _selected ?? fixtures.first;
        final result = _result;
        final step = result?.timeline[_frame];
        final angle = step?.angle;
        final feedback = step?.feedbackLabel;
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: [
            Text('PHÁT LẠI ĐIỂM KHỚP', style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontWeight: FontWeight.w700, letterSpacing: 1.5)),
            const SizedBox(height: 8),
            const Text('Dữ liệu tổng hợp để kiểm tra bộ đếm. Kết quả phát lại không được lưu như buổi tập thật.'),
            const SizedBox(height: 16),
            DropdownButton<PoseFixture>(
              isExpanded: true,
              value: fixture,
              onChanged: _busy ? null : (next) {
                if (next == null) return;
                _timer?.cancel();
                setState(() {
                  _timer = null; _selected = next; _frame = 0; _result = null; _error = null;
                });
              },
              items: [
                for (final item in fixtures)
                  DropdownMenuItem(value: item, child: Text(item.title, overflow: TextOverflow.ellipsis)),
              ],
            ),
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: CustomPaint(
                  painter: SkeletonPainter(fixture.frames[_frame]),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
            if (result != null) ...[
              Row(children: [
                IconButton(
                  tooltip: _timer == null ? 'Phát lại' : 'Dừng',
                  onPressed: () => _play(fixture.frames.length),
                  icon: Icon(_timer == null ? Icons.play_arrow_rounded : Icons.pause_rounded),
                ),
                Expanded(child: Slider(
                  value: _frame.toDouble(),
                  max: (fixture.frames.length - 1).toDouble(),
                  onChanged: (value) {
                    _timer?.cancel();
                    setState(() { _timer = null; _frame = value.round(); });
                  },
                )),
                Text('${_frame + 1}/${fixture.frames.length}'),
              ]),
              Text(step?.phaseLabel ?? 'Đang chờ', style: Theme.of(context).textTheme.titleLarge),
              Text(angle == null ? 'Góc khớp: —' : 'Góc khớp: ${angle.toStringAsFixed(1)}°'),
              if (feedback != null) Text(feedback),
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                Chip(label: Text('Hoàn tất ${step?.completed ?? 0}')),
                Chip(label: Text('Đạt luật form ${step?.formOk ?? 0}')),
                Chip(label: Text('Chưa đủ biên độ ${step?.partial ?? 0}')),
              ]),
              const SizedBox(height: 8),
              Text('Tổng kết: ${result.summary.completed} rep · ${result.trackedFrames}/${result.timeline.length} mẫu theo dõi được.'),
              Text('Bộ xử lý: ${result.engineVersion}'),
            ],
            const SizedBox(height: 16),
            if (_error != null) ...[
              Text(_error ?? '', style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 10),
            ],
            FilledButton.icon(
              onPressed: _busy ? null : () => _run(fixture),
              icon: Icon(_busy ? Icons.hourglass_top : Icons.analytics_outlined),
              label: Text(_busy ? 'Đang phân tích…' : 'Phân tích bằng backend C#'),
            ),
          ],
        );
      },
    ),
  );
}

class SkeletonPainter extends CustomPainter {
  SkeletonPainter(this.frame, {this.transparent = false});
  final PoseFrame frame;
  final bool transparent;
  static const connections = [
    ('shoulder', 'elbow'), ('elbow', 'wrist'), ('shoulder', 'hip'),
    ('hip', 'knee'), ('knee', 'ankle'), ('hip', 'ankle'),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    if (!transparent) canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xff071427));
    final scale = math.min(size.width / frame.width, size.height / frame.height);
    final w = frame.width * scale, h = frame.height * scale;
    final origin = Offset((size.width - w) / 2, (size.height - h) / 2);
    if (!transparent) {
      final grid = Paint()..color = const Color(0xff182e45)..strokeWidth = 1;
      for (var i = 1; i < 10; i++) {
        canvas.drawLine(Offset(size.width * i / 10, 0), Offset(size.width * i / 10, size.height), grid);
      }
      for (var i = 1; i < 6; i++) {
        canvas.drawLine(Offset(0, size.height * i / 6), Offset(size.width, size.height * i / 6), grid);
      }
    }
    Offset position(Joint j) => origin + Offset(j.x * w, j.y * h);
    final bone = Paint()..color = const Color(0xff40e0ee)..strokeWidth = 3..strokeCap = StrokeCap.round;
    for (final side in const ['left', 'right']) {
      for (final (a, b) in connections) {
        if (a == 'hip' && b == 'ankle' && frame.joints.containsKey('${side}_knee')) continue;
        final start = frame.joints['${side}_$a'];
        final end = frame.joints['${side}_$b'];
        if (start != null && end != null && start.score >= .4 && end.score >= .4) {
          canvas.drawLine(position(start), position(end), bone);
        }
      }
    }
    for (final joint in frame.joints.values) {
      if (joint.score >= .4) canvas.drawCircle(position(joint), 4, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(covariant SkeletonPainter oldDelegate) => oldDelegate.frame != frame || oldDelegate.transparent != transparent;
}

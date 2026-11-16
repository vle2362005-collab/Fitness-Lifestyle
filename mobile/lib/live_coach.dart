import 'dart:async';
import 'dart:typed_data';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';

import 'api.dart';
import 'models.dart';
import 'replay_page.dart';

/// Inference stays on the Android phone. Only normalized joints go to ASP.NET.
class AndroidPoseInput {
  static InputImage fromCamera(CameraImage image, InputImageRotation rotation) {
    final width = image.width, height = image.height;
    if (width.isOdd || height.isOdd) {
      throw const FormatException('Kích thước khung hình camera không phù hợp NV21.');
    }
    final length = width * height * 3 ~/ 2;
    final Uint8List bytes;
    if (image.planes.length == 1 &&
        image.planes.first.bytesPerRow == width && image.planes.first.bytes.length >= length) {
      bytes = Uint8List.sublistView(image.planes.first.bytes, 0, length);
    } else if (image.planes.length == 3) {
      // Android YUV_420_888 planes are Y, U, V. Respect row and pixel strides.
      final y = image.planes[0], u = image.planes[1], v = image.planes[2];
      final yStride = y.bytesPerPixel ?? 1, uStride = u.bytesPerPixel ?? 1, vStride = v.bytesPerPixel ?? 1;
      final lastY = (height - 1) * y.bytesPerRow + (width - 1) * yStride;
      final lastU = (height ~/ 2 - 1) * u.bytesPerRow + (width ~/ 2 - 1) * uStride;
      final lastV = (height ~/ 2 - 1) * v.bytesPerRow + (width ~/ 2 - 1) * vStride;
      if (lastY >= y.bytes.length || lastU >= u.bytes.length || lastV >= v.bytes.length) {
        throw const FormatException('Không đọc được các lớp ảnh YUV.');
      }
      bytes = Uint8List(length);
      var offset = 0;
      for (var row = 0; row < height; row++) {
        for (var col = 0; col < width; col++) {
          bytes[offset++] = y.bytes[row * y.bytesPerRow + col * yStride];
        }
      }
      for (var row = 0; row < height ~/ 2; row++) {
        for (var col = 0; col < width ~/ 2; col++) {
          bytes[offset++] = v.bytes[row * v.bytesPerRow + col * vStride];
          bytes[offset++] = u.bytes[row * u.bytesPerRow + col * uStride];
        }
      }
    } else {
      throw const FormatException('Camera không trả NV21 hoặc YUV 3 lớp. Thử bằng điện thoại Android thật.');
    }
    return InputImage.fromBytes(
      bytes: bytes,
      metadata: InputImageMetadata(
        size: Size(width.toDouble(), height.toDouble()), rotation: rotation,
        format: InputImageFormat.nv21, bytesPerRow: width,
      ),
    );
  }
}

class _Capture {
  String? id;
  CameraController? camera;
  PoseDetector? detector;
  Future<void>? inFlight;
  Future<void>? _closing;
  final clock = Stopwatch();
  int sequence = 0;
  int lastSample = -100;
  bool stopped = false;
  bool ready = false;

  Future<void> close() {
    stopped = true;
    return _closing ??= _close();
  }

  Future<void> _close() async {
    final controller = camera;
    if (controller?.value.isStreamingImages == true) {
      try { await controller?.stopImageStream(); } catch (_) {}
    }
    try { await inFlight; } catch (_) {}
    try { await detector?.close(); } catch (_) {}
    try { await controller?.dispose(); } catch (_) {}
    clock.stop();
  }
}

class LiveCoachPage extends StatefulWidget {
  const LiveCoachPage({super.key, required this.exercise, required this.api,
    required this.account, required this.onShare});
  final Exercise exercise;
  final FitnessApi api;
  final Account account;
  final void Function(BuildContext, int) onShare;

  @override
  State<LiveCoachPage> createState() => _LiveCoachPageState();
}

class _LiveCoachPageState extends State<LiveCoachPage> with WidgetsBindingObserver {
  static const landmarks = <PoseLandmarkType, String>{
    PoseLandmarkType.leftShoulder: 'left_shoulder', PoseLandmarkType.rightShoulder: 'right_shoulder',
    PoseLandmarkType.leftElbow: 'left_elbow', PoseLandmarkType.rightElbow: 'right_elbow',
    PoseLandmarkType.leftWrist: 'left_wrist', PoseLandmarkType.rightWrist: 'right_wrist',
    PoseLandmarkType.leftHip: 'left_hip', PoseLandmarkType.rightHip: 'right_hip',
    PoseLandmarkType.leftKnee: 'left_knee', PoseLandmarkType.rightKnee: 'right_knee',
    PoseLandmarkType.leftAnkle: 'left_ankle', PoseLandmarkType.rightAnkle: 'right_ankle',
  };
  _Capture? _capture;
  PoseFrame? _frame;
  PoseStep? _step;
  SavedWorkout? _saved;
  String? _error;
  bool _busy = false;
  bool _preview = false;

  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.paused && state != AppLifecycleState.hidden &&
        state != AppLifecycleState.detached) return;
    final capture = _capture;
    if (capture == null || capture.stopped) return;
    capture.stopped = true;
    if (capture.ready) {
      unawaited(capture.close());
      if (mounted) setState(() => _preview = false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    final capture = _capture;
    if (capture != null) {
      capture.stopped = true;
      if (capture.ready) unawaited(_disposeSession(capture));
    }
    super.dispose();
  }

  Future<void> _disposeSession(_Capture capture) async {
    await capture.close();
    final id = capture.id;
    if (id != null) {
      try { await widget.api.cancelCoach(id, widget.account); } catch (_) {}
    }
  }

  String _message(Object error) {
    if (error is ApiException) return error.message;
    if (error is FormatException) return error.message;
    if (error is CameraException) return error.description ?? 'Không mở được camera.';
    return 'Không xử lý được camera. Thử lại hoặc dùng ca phát lại.';
  }

  Future<void> _start() async {
    if (_capture != null || _busy) return;
    final capture = _Capture();
    _capture = capture;
    setState(() { _busy = true; _error = null; _frame = null; _step = null; _saved = null; });
    try {
      final devices = await availableCameras();
      final rear = devices.where((d) => d.lensDirection == CameraLensDirection.back);
      if (rear.isEmpty) throw const ApiException('Không tìm thấy camera sau.');
      final desc = rear.first;
      final rotation = InputImageRotationValue.fromRawValue(desc.sensorOrientation);
      if (rotation == null) throw const ApiException('Không xác định được hướng camera.');
      if (capture.stopped || !mounted) throw const ApiException('Đã dừng mở camera.');
      final controller = CameraController(
        desc, ResolutionPreset.medium, enableAudio: false, imageFormatGroup: ImageFormatGroup.nv21,
      );
      capture.camera = controller;
      await controller.initialize();
      await controller.lockCaptureOrientation(DeviceOrientation.portraitUp);
      if (capture.stopped || !mounted) throw const ApiException('Đã dừng mở camera.');
      capture.detector = PoseDetector(options: PoseDetectorOptions(
        mode: PoseDetectionMode.stream, model: PoseDetectionModel.base,
      ));
      capture.id = await widget.api.startCoach(widget.exercise, widget.account);
      if (capture.stopped || !mounted) throw const ApiException('Đã dừng mở camera.');
      capture.clock.start();
      await controller.startImageStream((image) => _onImage(capture, image, rotation));
      if (capture.stopped || !mounted) throw const ApiException('Đã dừng mở camera.');
      capture.ready = true;
      setState(() => _preview = true);
    } catch (error) {
      await _disposeSession(capture);
      if (mounted) setState(() { _capture = null; _preview = false; _error = _message(error); });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _onImage(_Capture capture, CameraImage image, InputImageRotation rotation) {
    if (!mounted || capture.stopped || capture.inFlight != null) return;
    final time = capture.clock.elapsedMilliseconds;
    if (time >= 595000) {
      capture.stopped = true;
      unawaited(capture.close());
      setState(() => _preview = false);
      return;
    }
    if (time - capture.lastSample < 100) return;
    capture.lastSample = time;
    capture.inFlight = _sample(capture, image, rotation, time).whenComplete(() => capture.inFlight = null);
  }

  Future<void> _sample(_Capture capture, CameraImage image, InputImageRotation rotation, int time) async {
    try {
      final detector = capture.detector;
      final id = capture.id;
      if (detector == null || id == null) return;
      final poses = await detector.processImage(AndroidPoseInput.fromCamera(image, rotation));
      if (!mounted || capture.stopped) return;
      final rotated = rotation == InputImageRotation.rotation90deg || rotation == InputImageRotation.rotation270deg;
      final width = rotated ? image.height : image.width, height = rotated ? image.width : image.height;
      final joints = <String, Joint>{};
      if (poses.isNotEmpty) {
        for (final entry in landmarks.entries) {
          final p = poses.first.landmarks[entry.key];
          if (p == null || !p.x.isFinite || !p.y.isFinite || !p.likelihood.isFinite) continue;
          joints[entry.value] = Joint(
            (p.x / width).clamp(0.0, 1.0).toDouble(),
            (p.y / height).clamp(0.0, 1.0).toDouble(),
            p.likelihood.clamp(0.0, 1.0).toDouble(),
          );
        }
      }
      final frame = PoseFrame(width, height, joints);
      setState(() => _frame = frame);
      final result = await widget.api.sendFrame(id, widget.account, {
        'sequence': capture.sequence++, 'timestampMs': time, 'width': width, 'height': height,
        'points': joints.map((name, p) => MapEntry(name, {'x': p.x, 'y': p.y, 'score': p.score})),
      });
      if (mounted && !capture.stopped) setState(() { _step = result; _error = null; });
    } catch (error) {
      if (!mounted || capture.stopped) return;
      setState(() => _error = _message(error));
      if (error is FormatException || (error is ApiException && [401, 404, 409].contains(error.status))) {
        capture.stopped = true;
        // Closing waits for this callback; do not await close inside the frame task.
        unawaited(capture.close());
        setState(() => _preview = false);
      }
    }
  }

  Future<void> _end(bool save) async {
    final capture = _capture;
    if (capture == null || _busy) return;
    setState(() { _busy = true; _preview = false; _error = null; });
    await capture.close();
    if (!mounted) return;
    try {
      final id = capture.id;
      if (id != null) {
        if (save) {
          final result = await widget.api.finishCoach(id, widget.account);
          if (mounted) setState(() { _saved = result; _step = result.result; });
        } else {
          await widget.api.cancelCoach(id, widget.account);
        }
      }
      if (mounted) setState(() => _capture = null);
    } catch (error) {
      if (mounted) setState(() {
        _error = _message(error);
        if (!save || (error is ApiException && error.status == 404)) _capture = null;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final frame = _frame, camera = _capture?.camera, step = _step, saved = _saved;
    final hint = step?.feedbackLabel;
    return Scaffold(
      appBar: AppBar(title: Text('AI Coach · ${widget.exercise.name}')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        const Text('Đặt điện thoại cố định, quay ngang thân người và giữ đủ cơ thể trong khung.'),
        const SizedBox(height: 12),
        if (_preview && camera != null)
          ClipRRect(borderRadius: BorderRadius.circular(16), child: AspectRatio(
            aspectRatio: frame == null ? 1 / camera.value.aspectRatio : frame.width / frame.height,
            child: Stack(fit: StackFit.expand, children: [
              CameraPreview(camera),
              if (frame != null) IgnorePointer(child: CustomPaint(painter: SkeletonPainter(frame, transparent: true))),
            ]),
          ))
        else
          const Card(child: Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Camera đang tắt')))),
        const SizedBox(height: 12),
        Text(step?.phaseLabel ?? 'Chờ bắt đầu', style: Theme.of(context).textTheme.titleLarge),
        Wrap(spacing: 8, children: [
          Chip(label: Text('${step?.completed ?? 0} rep')),
          Chip(label: Text('${step?.formOk ?? 0} đạt luật')),
          Chip(label: Text(step?.angle == null ? 'Góc —' : '${step?.angle?.toStringAsFixed(1)}°')),
        ]),
        if (hint != null) Text(hint),
        if (_error != null) Text(_error ?? '', style: TextStyle(color: Theme.of(context).colorScheme.error)),
        const SizedBox(height: 12),
        if (_capture == null)
          FilledButton(onPressed: _busy ? null : _start, child: const Text('Bắt đầu camera'))
        else
          Wrap(spacing: 10, children: [
            FilledButton(onPressed: _busy ? null : () => _end(true), child: const Text('Kết thúc và lưu')),
            OutlinedButton(onPressed: _busy ? null : () => _end(false), child: const Text('Hủy')),
          ]),
        if (_busy) const LinearProgressIndicator(),
        if (saved != null) ...[
          const Text('Đã lưu vào lịch sử tập.'),
          OutlinedButton(onPressed: () => widget.onShare(context, saved.analysisId), child: const Text('Chia sẻ kết quả')),
        ],
      ]),
    );
  }
}

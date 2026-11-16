import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'community.dart';
import 'live_coach.dart';
import 'models.dart';
import 'replay_page.dart';
import 'wellness.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  runApp(const FitnessApp());
}

class FitnessApp extends StatelessWidget {
  const FitnessApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Fitness & Lifestyle',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xff44deef), brightness: Brightness.dark,
      ).copyWith(
        primary: const Color(0xff62e8ef),
        surface: const Color(0xff14233a),
      ),
      scaffoldBackgroundColor: const Color(0xff0a1528),
    ),
    home: const FitnessHome(),
  );
}

class FitnessHome extends StatefulWidget {
  const FitnessHome({super.key});

  @override
  State<FitnessHome> createState() => _FitnessHomeState();
}

class _FitnessHomeState extends State<FitnessHome> {
  final _api = FitnessApi();
  int _tab = 0;
  MuscleGroup? _group;
  Account? _account;

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  int _revision = 0;

  @override
  void initState() {
    super.initState();
    _api.onUnauthorized = () {
      if (mounted) setState(() { _account = null; _tab = 2; });
    };
  }

  Future<void> _showExercise(Exercise exercise) async {
    await Navigator.of(context).push<void>(MaterialPageRoute(
      builder: (_) => ExercisePage(exercise: exercise, api: _api, account: _account),
    ));
    if (mounted && _account != null) setState(() => _revision++);
  }

  @override
  Widget build(BuildContext context) {
    final account = _account;
    final account = _account;
    final pages = [
      _landing(),
      _catalog(),
      ProgressPage(api: _api, account: account, revision: _revision,
        onAccount: (value) => setState(() => _account = value)),
      if (account != null)
        CommunityView(key: ValueKey(account.username), api: _api, account: account)
      else
        Center(child: FilledButton(onPressed: () => setState(() => _tab = 2),
          child: const Text('Đăng nhập để vào cộng đồng'))),
      if (account != null)
        WellnessView(api: _api, account: account)
      else
        Center(child: FilledButton(onPressed: () => setState(() => _tab = 2),
          child: const Text('Đăng nhập để xem hồ sơ và dinh dưỡng'))),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Fitness & Lifestyle', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: const [Padding(padding: EdgeInsets.only(right: 16), child: Icon(Icons.bolt_rounded, color: Color(0xff62e8ef)))],
      ),
      body: SafeArea(child: IndexedStack(index: _tab, children: pages)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Trang chủ'),
          NavigationDestination(icon: Icon(Icons.fitness_center), label: 'Bài tập'),
          NavigationDestination(icon: Icon(Icons.insights_outlined), label: 'Tiến độ'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), label: 'Cộng đồng'),
          NavigationDestination(icon: Icon(Icons.favorite_border), label: 'Sức khỏe'),
        ],
      ),
    );
  }

  Widget _landing() => ListView(
    padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(22),
        child: AspectRatio(
          aspectRatio: 1.82,
          child: Stack(fit: StackFit.expand, children: [
            Image.asset('assets/home_hero.png', fit: BoxFit.cover, alignment: Alignment.centerRight),
            const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(
              colors: [Color(0xee0a1029), Color(0x770a1029), Color(0x000a1029)],
              stops: [0, .58, 1],
            ))),
            Align(alignment: Alignment.centerLeft, child: Padding(
              padding: const EdgeInsets.all(16),
              child: FractionallySizedBox(widthFactor: .7, child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('TẬP TẠI NHÀ', style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w700, letterSpacing: 1.8)),
                  const SizedBox(height: 6),
                  Text('Bắt đầu từ\nbài tập cơ bản', style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.white, fontWeight: FontWeight.w800, height: 1.1)),
                ],
              )),
            )),
          ]),
        ),
      ),
      const SizedBox(height: 20),
      Text('Chọn nhóm cơ', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 10),
      Wrap(spacing: 8, runSpacing: 6, children: [
        for (final group in MuscleGroup.values)
          ActionChip(label: Text(group.label), onPressed: () => setState(() { _group = group; _tab = 1; })),
      ]),
      const SizedBox(height: 20),
      Text('AI Coach', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      for (final exercise in exercises.where((item) => item.coachKey != null))
        _exerciseCard(exercise),
    ],
  );

  Widget _catalog() => ListView(
    padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
    children: [
      Text('Thư viện tập tại nhà', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 6),
      const Text('Chọn theo nhóm cơ hoặc mở ca thử để xem cách AI Coach đếm rep.'),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 4, children: [
        FilterChip(label: const Text('Tất cả'), selected: _group == null,
          onSelected: (_) => setState(() => _group = null)),
        for (final group in MuscleGroup.values)
          FilterChip(label: Text(group.label), selected: _group == group,
            onSelected: (selected) => setState(() => _group = selected ? group : null)),
      ]),
      const SizedBox(height: 12),
      for (final exercise in exercises.where((item) => _group == null || item.group == _group))
        _exerciseCard(exercise),
    ],
  );

  Widget _exerciseCard(Exercise exercise) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    child: ListTile(
      leading: CircleAvatar(child: Icon(exercise.coachKey == null ? Icons.fitness_center : Icons.accessibility_new)),
      title: Text(exercise.name, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${exercise.group.label} · ${exercise.equipment}${exercise.coachKey == null ? '' : ' · Camera AI'}'),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => _showExercise(exercise),
    ),
  );
}

class ProgressPage extends StatefulWidget {
  const ProgressPage({super.key, required this.api, required this.onAccount, required this.revision, this.account});
  final FitnessApi api;
  final Account? account;
  final ValueChanged<Account?> onAccount;
  final int revision;

  @override
  State<ProgressPage> createState() => _ProgressPageState();
}

class _ProgressPageState extends State<ProgressPage> {
  final _form = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _password = TextEditingController();
  Future<List<WorkoutEntry>>? _history;
  String? _error;
  bool _busy = false;

  @override
  void didUpdateWidget(covariant ProgressPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final account = widget.account;
    if (account != oldWidget.account || widget.revision != oldWidget.revision) _history = account == null ? null : widget.api.history(account);
  }

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login({bool register = false}) async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _error = null; });
    try {
      if (register) {
        if (_password.text.length < 8) throw const ApiException('Tạo mật khẩu ít nhất 8 ký tự.');
        await widget.api.register(_username.text.trim(), _password.text);
      }
      final account = await widget.api.login(_username.text.trim(), _password.text);
      if (!mounted) return;
      _password.clear();
      widget.onAccount(account);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error is ApiException ? error.message : 'Không đọc được phản hồi đăng nhập.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final account = widget.account;
    return ListView(padding: const EdgeInsets.fromLTRB(20, 10, 20, 24), children: [
      Text('Tiến độ tập', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 8),
      if (account == null) ...[
        const Text('Đăng nhập bằng tài khoản Fitness & Lifestyle để xem lịch sử tập đã lưu.'),
        const SizedBox(height: 18),
        Form(key: _form, child: Column(children: [
          TextFormField(
            controller: _username, textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'Tài khoản hoặc email'),
            validator: (value) => (value?.trim().isEmpty ?? true) ? 'Nhập tài khoản.' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _password, obscureText: true,
            decoration: const InputDecoration(labelText: 'Mật khẩu'),
            validator: (value) => (value?.isEmpty ?? true) ? 'Nhập mật khẩu.' : null,
            onFieldSubmitted: (_) { if (!_busy) _login(); },
          ),
          const SizedBox(height: 16),
          if (_error != null) Text(_error ?? '', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          FilledButton(onPressed: _busy ? null : () => _login(), child: Text(_busy ? 'Đang kết nối…' : 'Đăng nhập')),
          TextButton(onPressed: _busy ? null : () => _login(register: true), child: const Text('Tạo tài khoản')),
        ])),
      ] else ...[
        Text('Xin chào, ${account.username}'),
        Wrap(spacing: 8, children: [
          OutlinedButton(onPressed: () => setState(() => _history = widget.api.history(account)), child: const Text('Làm mới')),
          TextButton(onPressed: () => widget.onAccount(null), child: const Text('Đăng xuất')),
        ]),
        FutureBuilder<List<WorkoutEntry>>(future: _history, builder: (context, snapshot) {
          if (snapshot.hasError) {
            final error = snapshot.error;
            return Text(error is ApiException ? error.message : 'Không đọc được lịch sử.');
          }
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()));
          }
          final items = snapshot.data ?? const <WorkoutEntry>[];
          if (items.isEmpty) return const Text('Bạn chưa có buổi tập đã lưu.');
          return Column(children: [
            for (final item in items)
              Card(child: ListTile(
                title: Text(item.name),
                subtitle: Text('${item.reps} rep · ${item.seconds} giây'),
                trailing: Text(item.date?.toString().split(' ').first ?? '—'),
              )),
          ]);
        }),
      ],
    ]);
  }
}

class ExercisePage extends StatefulWidget {
  const ExercisePage({super.key, required this.exercise, required this.api, this.account});
  final Exercise exercise;
  final FitnessApi api;
  final Account? account;
  @override
  State<ExercisePage> createState() => _ExercisePageState();
}
class _ExercisePageState extends State<ExercisePage> {
  final _form = GlobalKey<FormState>();
  final _minutes = TextEditingController(text: '5');
  final _reps = TextEditingController(text: '0');
  final _sets = TextEditingController(text: '1');
  bool _busy = false;
  String? _notice;

  @override
  void dispose() { _minutes.dispose(); _reps.dispose(); _sets.dispose(); super.dispose(); }

  Future<void> _save() async {
    final account = widget.account;
    if (account == null || _busy || !(_form.currentState?.validate() ?? false)) return;
    setState(() { _notice = null; _busy = true; });
    try {
      await widget.api.logWorkout(widget.exercise, account,
        int.parse(_minutes.text.trim()), int.parse(_reps.text.trim()), int.parse(_sets.text.trim()));
      if (mounted) setState(() => _notice = 'Đã lưu buổi tập thủ công. Có thể xem ở Tiến độ.');
    } catch (error) {
      if (mounted) setState(() => _notice = apiError(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String label, TextEditingController controller, int min, int max) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextFormField(controller: controller, keyboardType: TextInputType.number,
      decoration: InputDecoration(labelText: label),
      validator: (value) {
        final n = int.tryParse(value?.trim() ?? '');
        return n == null || n < min || n > max ? 'Nhập số nguyên từ $min đến $max.' : null;
      },
    ),
  );

  @override
  Widget build(BuildContext context) {
    final exercise = widget.exercise;
    final account = widget.account;
    return Scaffold(appBar: AppBar(title: Text(exercise.name)),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Wrap(spacing: 8, children: [
          Chip(label: Text(exercise.group.label)), Chip(label: Text(exercise.equipment)),
        ]),
        const SizedBox(height: 12),
        Text(exercise.description, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 16),
        if (exercise.coachKey != null && account != null) ...[
          FilledButton.icon(icon: const Icon(Icons.videocam_outlined), label: const Text('Mở camera AI'),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => LiveCoachPage(
              exercise: exercise, api: widget.api, account: account, onShare: (ctx, id) {
                Navigator.of(ctx).push(MaterialPageRoute(builder: (_) => Scaffold(
                  appBar: AppBar(title: const Text('Chia sẻ buổi tập')),
                  body: CommunityView(api: widget.api, account: account, initialAnalysis: id),
                )));
              },
            )))),
          OutlinedButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ReplayPage(exercise: exercise, api: widget.api, account: account))),
            child: const Text('Thử dữ liệu mẫu')),
        ] else if (exercise.coachKey == null)
          const Text('Bài này ghi kết quả thủ công.'),
        const SizedBox(height: 16),
        if (account == null)
          const Text('Đăng nhập ở mục Tiến độ để tập và lưu kết quả.')
        else
          Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Ghi buổi tập thủ công', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 10),
            _field('Thời gian (phút)', _minutes, 1, 120),
            _field('Số rep (0 nếu bài giữ tư thế)', _reps, 0, 1000),
            _field('Số hiệp', _sets, 0, 50),
            FilledButton(onPressed: _busy ? null : _save, child: Text(_busy ? 'Đang lưu…' : 'Lưu buổi tập')),
          ])),
        if (_notice != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_notice ?? '')),
      ]),
    );
  }
}

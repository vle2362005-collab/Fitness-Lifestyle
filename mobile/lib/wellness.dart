import 'package:flutter/material.dart';

import 'api.dart';
import 'community.dart';
import 'models.dart';

class WellnessView extends StatelessWidget {
  const WellnessView({super.key, required this.api, required this.account});
  final FitnessApi api;
  final Account account;

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(16), children: [
      Text('Sức khỏe và dinh dưỡng', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 12),
      Card(child: ListTile(
        leading: const Icon(Icons.person_outline), title: const Text('Hồ sơ sức khỏe'),
        subtitle: const Text('Cập nhật thông tin và mục tiêu tập luyện'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => _ProfilePage(api: api, account: account),
        )),
      )),
      Card(child: ListTile(
        leading: const Icon(Icons.restaurant_outlined), title: const Text('Nhật ký dinh dưỡng'),
        subtitle: const Text('Ghi khẩu phần và xem tổng theo ngày'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => _NutritionPage(api: api, account: account),
        )),
      )),
    ],
  );
}

class _ProfilePage extends StatefulWidget {
  const _ProfilePage({required this.api, required this.account});
  final FitnessApi api;
  final Account account;
  @override
  State<_ProfilePage> createState() => _ProfilePageState();
}
class _ProfilePageState extends State<_ProfilePage> {
  static const genders = {'Male': 'Nam', 'Female': 'Nữ', 'Other': 'Khác'};
  static const activities = {
    'Sedentary': 'Ít vận động', 'LightlyActive': 'Vận động nhẹ',
    'ModeratelyActive': 'Vận động vừa', 'VeryActive': 'Vận động nhiều', 'ExtraActive': 'Rất nhiều',
  };
  static const goals = {'WeightLoss': 'Giảm cân', 'Maintenance': 'Duy trì', 'MuscleGain': 'Tăng cơ'};
  final _form = GlobalKey<FormState>();
  final _height = TextEditingController(), _weight = TextEditingController(), _age = TextEditingController();
  String _gender = 'Other', _activity = 'Sedentary', _goal = 'Maintenance';
  String? _message;
  bool _busy = true, _failedLoad = false;
  Json? _profile;

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { _height.dispose(); _weight.dispose(); _age.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _busy = true; _failedLoad = false; _message = null; });
    try {
      final p = await widget.api.profile(widget.account);
      if (!mounted) return;
      if (p != null) {
        _height.text = p['height'].toString(); _weight.text = p['weight'].toString(); _age.text = p['age'].toString();
        final g = p['gender'], a = p['activityLevel'], o = p['goal'];
        if (g is String && genders.containsKey(g)) _gender = g;
        if (a is String && activities.containsKey(a)) _activity = a;
        if (o is String && goals.containsKey(o)) _goal = o;
      }
      setState(() => _profile = p);
    } catch (e) {
      if (mounted) setState(() { _failedLoad = true; _message = apiError(e); });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  double? _number(String? value) => double.tryParse((value ?? '').trim().replaceAll(',', '.'));

  Future<void> _save() async {
    if (_busy || !(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _message = null; });
    try {
      final p = await widget.api.saveProfile(widget.account, {
        'height': _number(_height.text), 'weight': _number(_weight.text), 'age': _number(_age.text)?.toInt(),
        'gender': _gender, 'activityLevel': _activity, 'goal': _goal,
      });
      if (mounted) setState(() { _profile = p; _message = 'Đã lưu hồ sơ.'; });
    } catch (e) {
      if (mounted) setState(() => _message = apiError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String name, TextEditingController controller, int min, int max, {bool integer = false}) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: TextFormField(controller: controller, enabled: !_busy, keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: name),
      validator: (text) {
        final value = _number(text);
        return value == null || !value.isFinite || value < min || value > max || (integer && value != value.round())
          ? 'Nhập giá trị phù hợp từ $min đến $max.' : null;
      },
    ),
  );

  Widget _select(String label, String value, Map<String, String> choices, ValueChanged<String> change) => ListTile(
    contentPadding: EdgeInsets.zero, title: Text(label),
    trailing: DropdownButton<String>(value: value,
      items: choices.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
      onChanged: _busy ? null : (next) { if (next != null) setState(() => change(next)); }),
  );

  @override
  Widget build(BuildContext context) {
    final p = _profile;
    return Scaffold(appBar: AppBar(title: const Text('Hồ sơ sức khỏe')),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      if (_busy) const LinearProgressIndicator(),
      if (_message != null) Text(_message ?? ''),
      if (_failedLoad)
        OutlinedButton(onPressed: _busy ? null : _load, child: const Text('Tải lại'))
      else
        Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _field('Chiều cao (cm)', _height, 50, 250),
          _field('Cân nặng (kg)', _weight, 30, 300),
          _field('Tuổi', _age, 10, 100, integer: true),
          _select('Giới tính', _gender, genders, (x) => _gender = x),
          _select('Mức vận động', _activity, activities, (x) => _activity = x),
          _select('Mục tiêu', _goal, goals, (x) => _goal = x),
          FilledButton(onPressed: _busy ? null : _save, child: const Text('Lưu hồ sơ')),
        ])),
      if (p != null)
        Wrap(spacing: 8, children: [
          Chip(label: Text('BMI ${(p['bmi'] as num?)?.toStringAsFixed(1) ?? '—'}')),
          Chip(label: Text('TDEE ước tính ${(p['tdee'] as num?)?.round() ?? '—'} kcal')),
        ]),
    ]),
  );
  }
}

class _NutritionPage extends StatefulWidget {
  const _NutritionPage({required this.api, required this.account});
  final FitnessApi api;
  final Account account;
  @override
  State<_NutritionPage> createState() => _NutritionPageState();
}
class _NutritionPageState extends State<_NutritionPage> {
  static const meals = {'Breakfast': 'Sáng', 'Lunch': 'Trưa', 'Dinner': 'Tối', 'Snack': 'Bữa phụ'};
  final _quantity = TextEditingController(text: '1');
  DateTime _day = DateTime.now();
  List<Json> _foods = [];
  Json? _summary;
  int? _food;
  String _meal = 'Breakfast';
  String? _message;
  bool _busy = false;

  String get _date => '${_day.year}-${_day.month.toString().padLeft(2, '0')}-${_day.day.toString().padLeft(2, '0')}';
  @override
  void initState() { super.initState(); _action(_load); }
  @override
  void dispose() { _quantity.dispose(); super.dispose(); }

  Future<void> _load() async {
    final foods = _foods.isEmpty ? await widget.api.foods() : _foods;
    final summary = await widget.api.nutrition(widget.account, _date);
    if (mounted) setState(() { _foods = foods; _summary = summary; });
  }
  Future<void> _action(Future<void> Function() work) async {
    if (_busy) return;
    setState(() { _busy = true; _message = null; });
    try { await work(); }
    catch (e) { if (mounted) setState(() => _message = apiError(e)); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(context: context, initialDate: _day,
      firstDate: DateTime(2000), lastDate: DateTime.now());
    if (!mounted || date == null) return;
    setState(() { _day = date; _summary = null; });
    await _action(_load);
  }

  Future<void> _add() async {
    final id = _food;
    final count = double.tryParse(_quantity.text.trim().replaceAll(',', '.'));
    if (id == null || count == null || !count.isFinite || count <= 0 || count > 30) {
      setState(() => _message = 'Chọn món và nhập số khẩu phần lớn hơn 0, tối đa 30.');
      return;
    }
    await _action(() async {
      await widget.api.addMeal(widget.account, id, count, _meal, _date);
      await _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final summary = _summary;
    final logs = summary == null ? const <Json>[] : arrayFrom(summary['logs']).map(objectFrom).toList();
    return Scaffold(appBar: AppBar(title: const Text('Nhật ký dinh dưỡng')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Wrap(spacing: 10, children: [
          OutlinedButton(onPressed: _busy ? null : _pickDate, child: Text(_date)),
          TextButton(onPressed: _busy ? null : () => _action(_load), child: const Text('Tải lại')),
        ]),
        if (_busy) const LinearProgressIndicator(),
        if (_message != null) Text(_message ?? ''),
        if (summary != null) Wrap(spacing: 8, children: [
          Chip(label: Text('${summary['totalCalories']} kcal')),
          Chip(label: Text('Đạm ${summary['totalProtein']} g')),
          Chip(label: Text('Carb ${summary['totalCarbs']} g')),
          Chip(label: Text('Béo ${summary['totalFat']} g')),
        ]),
        const SizedBox(height: 10),
        DropdownButton<int>(isExpanded: true, value: _food, hint: const Text('Chọn món ăn'),
          items: _foods.map((f) => DropdownMenuItem(
            value: f['id'] as int, child: Text('${f['name']}', overflow: TextOverflow.ellipsis))).toList(),
          onChanged: _busy ? null : (value) => setState(() => _food = value)),
        DropdownButton<String>(value: _meal,
          items: meals.entries.map((e) => DropdownMenuItem(value: e.key, child: Text(e.value))).toList(),
          onChanged: _busy ? null : (value) { if (value != null) setState(() => _meal = value); }),
        TextField(controller: _quantity, enabled: !_busy,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Số khẩu phần theo đơn vị món')),
        const SizedBox(height: 10),
        FilledButton(onPressed: _busy ? null : _add, child: const Text('Lưu món')),
        for (final log in logs) Card(child: ListTile(
          title: Text(log['foodName'] as String? ?? 'Món ăn'),
          subtitle: Text('${log['quantity']} phần · ${log['calories']} kcal'),
          trailing: IconButton(icon: const Icon(Icons.delete_outline), tooltip: 'Xóa món',
            onPressed: _busy ? null : () => _action(() async {
              await widget.api.deleteMeal(widget.account, log['id'] as int);
              await _load();
            })),
        )),
      ]),
    );
  }
}

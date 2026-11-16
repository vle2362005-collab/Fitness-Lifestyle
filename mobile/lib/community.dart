import 'package:flutter/material.dart';

import 'api.dart';
import 'models.dart';

String apiError(Object error) => error is ApiException ? error.message : 'Không đọc được dữ liệu. Thử lại.';

class CommunityView extends StatefulWidget {
  const CommunityView({super.key, required this.api, required this.account, this.initialAnalysis});
  final FitnessApi api;
  final Account account;
  final int? initialAnalysis;

  @override
  State<CommunityView> createState() => _CommunityViewState();
}

class _CommunityViewState extends State<CommunityView> {
  List<FeedPost> _posts = [];
  int? _before;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _action(_load);
      if (mounted && widget.initialAnalysis != null) await _compose(initialAnalysis: widget.initialAnalysis);
    });
  }

  Future<void> _load({int? before}) async {
    final page = await widget.api.feed(widget.account, before: before);
    if (!mounted) return;
    setState(() {
      _posts = before == null ? page.items : [..._posts, ...page.items];
      _before = page.nextBefore;
    });
  }

  Future<void> _action(Future<void> Function() job) async {
    if (_busy) return;
    setState(() { _busy = true; _error = null; });
    try { await job(); }
    catch (e) { if (mounted) setState(() => _error = apiError(e)); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _compose({FeedPost? post, String? draft, int? initialAnalysis}) async {
    if (_busy) return;
    final result = await showDialog<bool>(context: context, barrierDismissible: false,
      builder: (_) => _Composer(api: widget.api, account: widget.account,
        post: post, draft: draft, initialAnalysis: initialAnalysis));
    if (mounted && result == true) await _action(_load);
  }

  Future<void> _comments(FeedPost post) async {
    final draft = await Navigator.of(context).push<String>(MaterialPageRoute(
      builder: (_) => _CommentsPage(api: widget.api, account: widget.account, post: post),
    ));
    if (!mounted) return;
    if (draft != null && post.isMine) await _compose(post: post, draft: draft);
    if (mounted) await _action(_load);
  }

  Future<void> _delete(FeedPost post) async {
    final yes = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Xóa bài viết?'),
      content: const Text('Bình luận và lượt thích của bài này cũng sẽ bị xóa.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Giữ lại')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Xóa')),
      ],
    ));
    if (mounted && yes == true) await _action(() async {
      await widget.api.deletePost(widget.account, post.id);
      await _load();
    });
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
    children: [
      Text('Cộng đồng', style: Theme.of(context).textTheme.headlineSmall),
      const Text('Chia sẻ tiến bộ và góp ý cách tập.'),
      const SizedBox(height: 10),
      Wrap(spacing: 8, children: [
        FilledButton.icon(onPressed: _busy ? null : () => _compose(),
          icon: const Icon(Icons.edit_outlined), label: const Text('Viết bài')),
        OutlinedButton(onPressed: _busy ? null : () => _action(_load), child: const Text('Làm mới')),
      ]),
      if (_busy) const LinearProgressIndicator(),
      if (_error != null) Padding(padding: const EdgeInsets.all(8),
        child: Text(_error ?? '', style: TextStyle(color: Theme.of(context).colorScheme.error))),
      if (_posts.isEmpty && !_busy && _error == null)
        const Padding(padding: EdgeInsets.all(12), child: Text('Chưa có bài viết.')),
      for (final post in _posts)
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(post.author, style: const TextStyle(fontWeight: FontWeight.w700)),
            if (post.updatedAt != null) const Text('Đã sửa', style: TextStyle(fontSize: 12)),
            const SizedBox(height: 8),
            Text(post.content),
            if (post.exerciseName != null)
              Chip(label: Text('${post.exerciseName} · ${post.reps ?? 0} rep · ${post.durationSeconds ?? 0} giây')),
            Wrap(spacing: 6, children: [
              TextButton.icon(onPressed: _busy ? null : () => _action(() async {
                await widget.api.toggleLike(widget.account, post);
                await _load();
              }), icon: Icon(post.liked ? Icons.favorite : Icons.favorite_border), label: Text('${post.likeCount}')),
              TextButton(onPressed: _busy ? null : () => _comments(post),
                child: Text('Bình luận · ${post.commentCount}')),
              if (post.isMine) ...[
                TextButton(onPressed: _busy ? null : () => _compose(post: post), child: const Text('Sửa')),
                TextButton(onPressed: _busy ? null : () => _delete(post), child: const Text('Xóa')),
              ],
            ]),
          ],
        ))),
      if (_before != null) OutlinedButton(onPressed: _busy ? null : () => _action(() => _load(before: _before)),
        child: const Text('Xem bài cũ hơn')),
    ],
  );
}

class _Composer extends StatefulWidget {
  const _Composer({required this.api, required this.account, this.post, this.draft, this.initialAnalysis});
  final FitnessApi api;
  final Account account;
  final FeedPost? post;
  final String? draft;
  final int? initialAnalysis;
  @override
  State<_Composer> createState() => _ComposerState();
}
class _ComposerState extends State<_Composer> {
  late final TextEditingController _text;
  late final Future<List<WorkoutEntry>> _history;
  int? _analysis;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _text = TextEditingController(text: widget.draft ?? widget.post?.content ?? '');
    _analysis = widget.initialAnalysis;
    _history = widget.post == null ? widget.api.analyses(widget.account) : Future.value([]);
  }
  @override
  void dispose() { _text.dispose(); super.dispose(); }

  Future<void> _send() async {
    if (_text.text.trim().isEmpty || _busy) return;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.api.writePost(widget.account, _text.text.trim(), id: widget.post?.id, analysisId: _analysis);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { _error = apiError(e); _busy = false; });
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: Text(widget.post == null ? 'Bài viết mới' : 'Sửa bài của bạn'),
    content: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: _text, maxLength: 1500, minLines: 2, maxLines: 5,
        decoration: const InputDecoration(labelText: 'Nội dung'), onChanged: (_) => setState(() {})),
      if (widget.post == null)
        FutureBuilder<List<WorkoutEntry>>(future: _history, builder: (context, snapshot) {
          final items = snapshot.data ?? [];
          if (snapshot.connectionState == ConnectionState.waiting) return const LinearProgressIndicator();
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Tóm tắt buổi tập (tùy chọn)'),
            if (snapshot.hasError) const Text('Chưa tải được danh sách buổi tập.'),
            DropdownButton<int>(
              isExpanded: true, value: items.any((x) => x.id == _analysis) ? _analysis : 0,
              items: [
                const DropdownMenuItem(value: 0, child: Text('Không đính kèm')),
                for (final x in items)
                  DropdownMenuItem(value: x.id, child: Text('${x.name} · ${x.reps} rep', overflow: TextOverflow.ellipsis)),
              ],
              onChanged: _busy ? null : (id) => setState(() => _analysis = id == 0 ? null : id),
            ),
          ]);
        }),
      if (_error != null) Text(_error ?? ''),
    ]),
    actions: [
      TextButton(onPressed: _busy ? null : () => Navigator.pop(context, false), child: const Text('Hủy')),
      FilledButton(onPressed: _busy || _text.text.trim().isEmpty ? null : _send,
        child: Text(_busy ? 'Đang lưu…' : widget.post == null ? 'Đăng' : 'Lưu')),
    ],
  );
}

class _CommentsPage extends StatefulWidget {
  const _CommentsPage({required this.api, required this.account, required this.post});
  final FitnessApi api;
  final Account account;
  final FeedPost post;
  @override
  State<_CommentsPage> createState() => _CommentsPageState();
}
class _CommentsPageState extends State<_CommentsPage> {
  final _text = TextEditingController();
  List<FeedComment> _comments = [];
  int? _before;
  bool _suggestion = false, _busy = false;
  String? _error;

  @override
  void initState() { super.initState(); _action(_load); }
  @override
  void dispose() { _text.dispose(); super.dispose(); }

  Future<void> _load({int? before}) async {
    final page = await widget.api.comments(widget.account, widget.post.id, before: before);
    if (mounted) setState(() {
      _comments = before == null ? page.items : [..._comments, ...page.items];
      _before = page.nextBefore;
    });
  }
  Future<void> _action(Future<void> Function() fn) async {
    if (_busy) return;
    setState(() { _busy = true; _error = null; });
    try { await fn(); }
    catch (e) { if (mounted) setState(() => _error = apiError(e)); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Bình luận và góp ý')),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      TextField(controller: _text, maxLength: 500, maxLines: 3,
        decoration: const InputDecoration(labelText: 'Nội dung'), onChanged: (_) => setState(() {})),
      CheckboxListTile(value: _suggestion, title: const Text('Góp ý chỉnh sửa'), contentPadding: EdgeInsets.zero,
        onChanged: _busy ? null : (value) => setState(() => _suggestion = value ?? false)),
      FilledButton(onPressed: _busy || _text.text.trim().isEmpty ? null : () => _action(() async {
        await widget.api.addComment(widget.account, widget.post.id, _text.text.trim(), _suggestion);
        if (!mounted) return;
        _text.clear(); setState(() => _suggestion = false);
        await _load();
      }), child: const Text('Gửi')),
      if (_busy) const LinearProgressIndicator(),
      if (_error != null) Text(_error ?? ''),
      for (final item in _comments)
        Card(child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${item.author}${item.isSuggestion ? ' · Góp ý' : ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
          Text(item.content),
          Wrap(spacing: 6, children: [
            if (widget.post.isMine && item.isSuggestion)
              TextButton(onPressed: () => Navigator.pop(context, item.content), child: const Text('Dùng làm bản nháp')),
            if (item.isMine) TextButton(onPressed: _busy ? null : () => _action(() async {
              await widget.api.deleteComment(widget.account, widget.post.id, item.id);
              await _load();
            }), child: const Text('Xóa bình luận')),
          ]),
        ]))),
      if (_before != null) TextButton(onPressed: _busy ? null : () => _action(() => _load(before: _before)),
        child: const Text('Xem bình luận cũ hơn')),
    ]),
  );
}

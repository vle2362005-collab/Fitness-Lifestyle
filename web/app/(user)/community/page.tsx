"use client";

import { useEffect, useState } from "react";
import { api } from "@/services/api";
import { communityApi } from "@/lib/dacn";
import type { Comment, FeedPost } from "@/lib/dacn";
import type { WorkoutAnalysis } from "@/lib/types";

const message = (error: unknown) => error instanceof Error ? error.message : "Không thực hiện được thao tác.";
function dateLabel(value: string) {
  const input = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + "Z";
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN") : "";
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [before, setBefore] = useState<number | null>(null);
  const [history, setHistory] = useState<WorkoutAnalysis[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBefore, setCommentBefore] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [suggestion, setSuggestion] = useState(false);

  async function load(cursor?: number) {
    const page = await communityApi.list(cursor);
    setPosts(prev => cursor ? [...prev, ...page.items] : page.items);
    setBefore(page.nextBefore);
  }
  async function loadComments(id: number, cursor?: number) {
    const page = await communityApi.comments(id, cursor);
    setComments(prev => cursor ? [...prev, ...page.items] : page.items);
    setCommentBefore(page.nextBefore);
  }
  useEffect(() => {
    let active = true;
    communityApi.list().then(data => {
      if (active) { setPosts(data.items); setBefore(data.nextBefore); }
    }).catch(e => { if (active) setError(message(e)); })
      .finally(() => { if (active) setBusy(false); });
    api.analysis.list().then(items => {
      if (!active) return;
      setHistory(items);
      const id = Number(new URLSearchParams(window.location.search).get("analysisId"));
      if (items.some(x => x.id === id)) setSelected(id);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function action(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  function edit(post: FeedPost, draft?: string) {
    setEditing(post.id); setContent(draft ?? post.content); setSelected(null);
    document.getElementById("post-content")?.focus();
  }
  function clearDraft() { setEditing(null); setContent(""); setSelected(null); }

  return <section className="page">
    <h1 className="page-title">Cộng đồng</h1>
    <p className="page-subtitle">Chia sẻ tiến bộ và góp ý cách tập cho nhau.</p>
    <div className="feed-column">
      <form className="card" onSubmit={e => {
        e.preventDefault();
        if (!content.trim() || busy) return;
        void action(async () => {
          if (editing == null) await communityApi.create(content, selected);
          else await communityApi.edit(editing, content);
          clearDraft(); await load();
        });
      }}>
        <label htmlFor="post-content"><strong>{editing == null ? "Bài viết mới" : "Sửa bài của bạn"}</strong></label>
        <textarea id="post-content" className="input" value={content} maxLength={1500} required
          onChange={e => setContent(e.target.value)} placeholder="Buổi tập hôm nay của bạn thế nào?" />
        {editing == null && <label className="label">Đính kèm tóm tắt buổi tập (tùy chọn)
          <select className="input" value={selected ?? ""} onChange={e => setSelected(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Không đính kèm</option>
            {history.map(x => <option key={x.id} value={x.id}>{x.exerciseName || "Bài tập"} · {x.totalReps} rep · {dateLabel(x.createdAt)}</option>)}
          </select>
        </label>}
        <div className="row coach-actions">
          <button className="btn" disabled={busy || !content.trim()}>{editing == null ? "Đăng bài" : "Lưu thay đổi"}</button>
          {editing != null && <button type="button" className="btn ghost" onClick={clearDraft}>Bỏ bản nháp</button>}
          <button type="button" className="btn ghost" disabled={busy} onClick={() => action(() => load())}>Làm mới</button>
        </div>
      </form>
      {error && <p role="alert" className="notice error">{error}</p>}
      {!posts.length && !busy && <div className="card muted">Chưa có bài viết.</div>}
      {posts.map(post => <article className="card" key={post.id}>
        <div><strong>{post.author}</strong><p className="muted small">{dateLabel(post.createdAt)}{post.updatedAt ? " · Đã sửa" : ""}</p></div>
        <p className="feed-content">{post.content}</p>
        {post.exerciseName && <div className="feed-summary">{post.exerciseName} · {post.reps ?? 0} rep · {Math.round(post.durationSeconds ?? 0)} giây</div>}
        <div className="row coach-actions">
          <button className={post.liked ? "btn secondary" : "btn ghost"} disabled={busy} aria-pressed={post.liked} onClick={() => action(async () => {
            await communityApi.like(post.id, post.liked);
            setPosts(items => items.map(item => item.id === post.id ? {
              ...item, liked: !item.liked, likeCount: Math.max(0, item.likeCount + (item.liked ? -1 : 1)),
            } : item));
          })}>{post.liked ? "Bỏ thích" : "Thích"} · {post.likeCount}</button>
          <button className="btn ghost" disabled={busy} onClick={() => {
            if (open === post.id) { setOpen(null); return; }
            setComments([]); setCommentText(""); setSuggestion(false); setCommentBefore(null);
            setOpen(post.id); void action(() => loadComments(post.id));
          }}>Bình luận · {post.commentCount}</button>
          {post.isMine && <>
            <button className="btn ghost" disabled={busy} onClick={() => edit(post)}>Sửa</button>
            <button className="btn ghost" disabled={busy} onClick={() => {
              if (!window.confirm("Xóa bài viết này và các bình luận?")) return;
              void action(async () => {
                await communityApi.remove(post.id);
                if (editing === post.id) clearDraft();
                setPosts(items => items.filter(item => item.id !== post.id));
              });
            }}>Xóa</button>
          </>}
        </div>
        {open === post.id && <div style={{marginTop: 12}}>
          {comments.map(c => <div key={c.id} className="feed-comment">
            <strong>{c.author}</strong>{c.isSuggestion && <span className="muted"> · Góp ý</span>}
            <p className="feed-content">{c.content}</p>
            {post.isMine && c.isSuggestion && <button className="btn secondary" onClick={() => edit(post, c.content)}>Dùng làm bản nháp</button>}
            {c.isMine && <button className="btn ghost" disabled={busy} onClick={() => action(async () => {
              await communityApi.deleteComment(post.id, c.id);
              setComments(items => items.filter(item => item.id !== c.id));
              setPosts(items => items.map(item => item.id === post.id ? {...item, commentCount: Math.max(0, item.commentCount - 1)} : item));
            })}>Xóa bình luận</button>}
          </div>)}
          {commentBefore !== null && <button className="btn ghost" disabled={busy} onClick={() => action(() => loadComments(post.id, commentBefore))}>Xem bình luận cũ hơn</button>}
          <form onSubmit={e => {
            e.preventDefault();
            if (!commentText.trim() || busy) return;
            void action(async () => {
              await communityApi.comment(post.id, commentText, suggestion);
              setCommentText(""); setSuggestion(false);
              setPosts(items => items.map(item => item.id === post.id ? {...item, commentCount: item.commentCount + 1} : item));
              await loadComments(post.id);
            });
          }}>
            <textarea className="input" aria-label="Nội dung bình luận" maxLength={500} value={commentText} onChange={e => setCommentText(e.target.value)} required />
            <div className="row coach-actions">
              <label><input type="checkbox" checked={suggestion} onChange={e => setSuggestion(e.target.checked)} /> Góp ý chỉnh sửa</label>
              <button className="btn" disabled={busy || !commentText.trim()}>Gửi</button>
            </div>
          </form>
        </div>}
      </article>)}
      {before !== null && <button className="btn secondary" disabled={busy} onClick={() => action(() => load(before))}>Xem bài cũ hơn</button>}
    </div>
  </section>;
}

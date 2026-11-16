"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ImagePlus, Pencil, Save, Trash2 } from "lucide-react";
import { api, toAssetUrl } from "@/services/api";
import type { Exercise } from "@/lib/types";

type ExerciseForm = {
  id?: number;
  name: string;
  category: string;
  description: string;
  caloriesPerMinute: number;
  metValue: number;
  videoUrl: string;
  aiConfig: string;
  imageFile: File | null;
};

const defaultAiConfig = JSON.stringify({
  mode: "angle",
  metricName: "Góc đầu gối",
  points: ["left_hip", "left_knee", "left_ankle"],
  minScore: 0.4,
  downRule: { operator: "<", value: 105, feedback: "Xuống đủ sâu, đứng lên!" },
  upRule: { operator: ">", value: 158, feedback: "Đứng thẳng, xuống tiếp!" },
  missingFeedback: "Đứng xa camera để thấy đủ khớp."
}, null, 2);

const aiTemplates: Record<string, object> = {
  pushup: { mode: "pushup", metricName: "Góc khuỷu tay + thân người", minScore: 0.35, strict: true },
  squat: { mode: "squat", metricName: "Góc đầu gối + độ sâu hông", minScore: 0.35, strict: true },
  plank: { mode: "plank", metricName: "Độ thẳng vai-hông-cổ chân", minScore: 0.35, strict: true },
  lunge: { mode: "lunge", metricName: "Góc gối trước + thân trên", minScore: 0.35, strict: true },
  jumping_jack: { mode: "jumping_jack", metricName: "Mở/khép tay chân", minScore: 0.35, strict: true },
  bicep_curl: { mode: "bicep_curl", metricName: "Góc khuỷu tay + ổn định cánh tay trên", minScore: 0.35, strict: true },
  shoulder_press: { mode: "shoulder_press", metricName: "Đẩy tay qua đầu", minScore: 0.35, strict: true },
  lateral_raise: { mode: "lateral_raise", metricName: "Độ nâng tay ngang vai", minScore: 0.35, strict: true },
  crunch: { mode: "crunch", metricName: "Gập thân với gối", minScore: 0.35, strict: true },
  mountain_climber: { mode: "mountain_climber", metricName: "Plank + kéo gối", minScore: 0.35, strict: true },
  high_knees: { mode: "high_knees", metricName: "Nâng gối cao", minScore: 0.35, strict: true },
  deadlift: { mode: "deadlift", metricName: "Hip hinge + lưng thẳng", minScore: 0.35, strict: true },
  glute_bridge: { mode: "glute_bridge", metricName: "Nâng hông", minScore: 0.35, strict: true }
};


const emptyForm: ExerciseForm = { name: "", category: "General", description: "", caloriesPerMinute: 6, metValue: 4, videoUrl: "", aiConfig: defaultAiConfig, imageFile: null };

function formatAiConfig(value?: string | null) {
  if (!value) return defaultAiConfig;
  try { return JSON.stringify(JSON.parse(value), null, 2); }
  catch { return value; }
}

function toFormData(form: ExerciseForm) {
  const fd = new FormData();
  fd.append("Name", form.name);
  fd.append("Category", form.category);
  fd.append("Description", form.description);
  fd.append("CaloriesPerMinute", String(form.caloriesPerMinute));
  fd.append("MetValue", String(form.metValue));
  fd.append("VideoUrl", form.videoUrl || "");
  fd.append("AiConfig", form.aiConfig || "");
  if (form.imageFile) fd.append("ImageFile", form.imageFile);
  return fd;
}

export default function AdminExercisesPage() {
  const [items, setItems] = useState<Exercise[]>([]);
  const [form, setForm] = useState<ExerciseForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    try { setItems(await api.exercises.list({ search })); }
    catch (err: any) { setError(err?.message || "Không tải được bài tập."); }
  }
  useEffect(() => { load(); }, []);

  function edit(exercise: Exercise) {
    setForm({
      id: exercise.id,
      name: exercise.name,
      category: exercise.category || "General",
      description: exercise.description || "",
      caloriesPerMinute: exercise.caloriesPerMinute || 5,
      metValue: exercise.metValue || 4,
      videoUrl: exercise.videoUrl || "",
      aiConfig: formatAiConfig(exercise.aiConfig),
      imageFile: null
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fileChanged(e: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, imageFile: e.target.files?.[0] || null });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(""); setError("");
    try {
      if (form.aiConfig) JSON.parse(form.aiConfig);
      const fd = toFormData(form);
      const res = form.id ? await api.exercises.update(form.id, fd) : await api.exercises.create(fd);
      setMessage(res.message);
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      setError(err?.message || "Không lưu được bài tập. Kiểm tra AiConfig JSON và quyền Admin.");
    }
  }

  async function uploadOnlyImage(exerciseId: number, file: File) {
    const fd = new FormData();
    fd.append("ImageFile", file);
    try {
      const res = await api.exercises.updateImage(exerciseId, fd);
      setMessage(res.message);
      await load();
    } catch (err: any) {
      setError(err?.message || "Không cập nhật được ảnh bài tập.");
    }
  }

  async function remove(id: number) {
    if (!confirm("Xóa bài tập này?")) return;
    try { await api.exercises.remove(id); await load(); }
    catch (err: any) { setError(err?.message || "Không xóa được bài tập."); }
  }

  return (
    <section className="page stack">
      <div>
        <h1 className="page-title">Quản lý bài tập</h1>
        <p className="page-subtitle">Đã tối ưu upload/cập nhật ảnh và bổ sung mẫu AiConfig MoveNet nghiêm ngặt cho các nhóm bài tập toàn thân.</p>
      </div>
      {message && <div className="notice">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <form className="card stack" onSubmit={submit}>
        <div className="between"><h2 className="card-title">{form.id ? "Cập nhật bài tập" : "Thêm bài tập"}</h2>{form.id && <button type="button" className="btn ghost" onClick={() => setForm(emptyForm)}>Hủy sửa</button>}</div>
        <div className="form-grid three">
          <label className="label">Tên<input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="label">Nhóm cơ<input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label className="label">Calories/phút<input className="input" type="number" min={1} value={form.caloriesPerMinute} onChange={(e) => setForm({ ...form, caloriesPerMinute: Number(e.target.value) })} /></label>
          <label className="label">MET<input className="input" type="number" step="0.1" min={0} value={form.metValue} onChange={(e) => setForm({ ...form, metValue: Number(e.target.value) })} /></label>
          <label className="label">Video URL<input className="input" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} /></label>
          <label className="label">Ảnh bài tập<input className="input" type="file" accept="image/*" onChange={fileChanged} /></label>
        </div>
        <label className="label">Mô tả<textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <div className="form-grid">
          <label className="label">Mẫu AI theo bài tập
            <select className="select" defaultValue="" onChange={(e) => e.target.value && setForm({ ...form, aiConfig: JSON.stringify(aiTemplates[e.target.value], null, 2) })}>
              <option value="">Chọn mẫu để tự điền AiConfig</option>
              {Object.keys(aiTemplates).map((key) => <option key={key} value={key}>{key}</option>)}
            </select>
          </label>
          <div className="notice warn">Các mẫu mới dùng MoveNet kiểm tra form nghiêm ngặt. Ví dụ pushup sẽ kiểm tra thân người ngang sàn + core thẳng, không chỉ gập khuỷu tay.</div>
        </div>
        <label className="label">AiConfig đơn giản<textarea className="textarea" style={{ minHeight: 190, fontFamily: "monospace" }} value={form.aiConfig} onChange={(e) => setForm({ ...form, aiConfig: e.target.value })} /></label>
        <button className="btn"><Save size={16} /> {form.id ? "Cập nhật" : "Thêm mới"}</button>
      </form>

      <div className="card stack">
        <div className="between">
          <h2 className="card-title">Danh sách bài tập</h2>
          <div className="row"><input className="input" style={{ width: 260 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm bài tập" /><button className="btn secondary" onClick={load}>Tìm</button></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ảnh</th><th>Tên</th><th>Nhóm</th><th>Kcal/phút</th><th>Cập nhật ảnh</th><th></th></tr></thead>
            <tbody>
              {items.map((item) => <tr key={item.id}>
                <td style={{ width: 96 }}>{item.imageUrl ? <img src={toAssetUrl(item.imageUrl)} alt={item.name} style={{ width: 72, height: 56, objectFit: "cover", borderRadius: 12 }} /> : <span className="badge gray">No image</span>}</td>
                <td><strong>{item.name}</strong><br /><span className="muted small">{item.description}</span></td>
                <td>{item.category}</td>
                <td>{item.caloriesPerMinute}</td>
                <td><label className="btn ghost"><ImagePlus size={15} /> Ảnh<input hidden type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadOnlyImage(item.id, e.target.files[0])} /></label></td>
                <td className="row"><button className="btn secondary" onClick={() => edit(item)}><Pencil size={15} /></button><button className="btn danger" onClick={() => remove(item.id)}><Trash2 size={15} /></button></td>
              </tr>)}
              {!items.length && <tr><td colSpan={6}>Chưa có bài tập.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Dumbbell, Flame, Search } from "lucide-react";
import { api, toAssetUrl } from "@/services/api";
import { coachKey } from "@/lib/dacn";
import type { Exercise } from "@/lib/types";

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [logForm, setLogForm] = useState({ minutes: 10, reps: 12, sets: 3, accuracy: 0 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [items, cats] = await Promise.all([api.exercises.list({ search, category }), api.exercises.categories().catch(() => [])]);
      setExercises(items);
      setCategories(cats);
      if (!selected && items[0]) setSelected(items[0]);
    } catch (err: any) {
      setError(err?.message || "Không tải được danh sách bài tập.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => exercises, [exercises]);

  async function saveWorkout() {
    if (!selected) return;
    setError("");
    setMessage("");
    try {
      const minutes = Math.max(1, Number(logForm.minutes));
      const calories = minutes * (selected.caloriesPerMinute || 5);
      const res = await api.workout.log({
        exerciseId: selected.id,
        durationMinutes: minutes,
        durationInSeconds: minutes * 60,
        reps: Number(logForm.reps) || 0,
        sets: Number(logForm.sets) || 0,
        accuracyScore: Number(logForm.accuracy) || 0,
        caloriesBurned: calories,
        performedAt: new Date().toISOString()
      });
      setMessage(`${res.message} Đốt khoảng ${Math.round(res.caloriesBurned)} kcal.`);
    } catch (err: any) {
      setError(err?.message || "Không lưu được buổi tập.");
    }
  }

  return (
    <section className="page stack">
      <div>
        <h1 className="page-title">Bài tập</h1>
        <p className="page-subtitle">Chọn bài tập, xem nhóm cơ và chuyển sang AI Coach để hệ thống kiểm tra tư thế khi luyện tập.</p>
      </div>

      <div className="card stack">
        <div className="form-grid">
          <label className="label">Tìm kiếm
            <div className="row" style={{ gap: 8 }}>
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Squat, Push-up..." />
            </div>
          </label>
          <label className="label">Nhóm cơ
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Tất cả</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <button className="btn" onClick={load}><Search size={16} /> Lọc bài tập</button>
      </div>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      {loading && <div className="card">Đang tải bài tập...</div>}

      <div className="grid">
        <div className="col-7 stack">
          {filtered.map((exercise) => (
            <button key={exercise.id} className="card exercise-card flat" onClick={() => setSelected(exercise)} style={{ textAlign: "left", borderColor: selected?.id === exercise.id ? "#22c55e" : undefined }}>
              <div className="exercise-img">
                {exercise.imageUrl ? <img src={toAssetUrl(exercise.imageUrl)} alt={exercise.name} /> : <Dumbbell size={34} />}
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <div className="between">
                  <h3 className="card-title" style={{ margin: 0 }}>{exercise.name}</h3>
                  <span className="badge gray">{exercise.category || "General"}</span>
                </div>
                <p className="muted" style={{ margin: 0 }}>{exercise.description || "Chưa có mô tả."}</p>
                <div className="row small muted">
                  <span className="row"><Flame size={15} /> {exercise.caloriesPerMinute || 0} kcal/phút</span>
                  <span className="row"><Clock size={15} /> MET {exercise.metValue || "-"}</span>
                </div>
              </div>
            </button>
          ))}
          {!filtered.length && !loading && <div className="card">Không tìm thấy bài tập phù hợp.</div>}
        </div>

        <aside className="card col-5 stack">
          <h2 className="card-title">Ghi nhanh buổi tập</h2>
          {selected ? (
            <>
              <div className="card soft">
                <strong>{selected.name}</strong>
                <p className="muted small">Calories sẽ tự tính theo calories/phút của bài tập, có thể xem lại trong Dashboard.</p>
              </div>
              <div className="form-grid">
                <label className="label">Phút
                  <input className="input" type="number" min={1} value={logForm.minutes} onChange={(e) => setLogForm({ ...logForm, minutes: Number(e.target.value) })} />
                </label>
                <label className="label">Reps
                  <input className="input" type="number" min={0} value={logForm.reps} onChange={(e) => setLogForm({ ...logForm, reps: Number(e.target.value) })} />
                </label>
                <label className="label">Sets
                  <input className="input" type="number" min={0} value={logForm.sets} onChange={(e) => setLogForm({ ...logForm, sets: Number(e.target.value) })} />
                </label>
                <label className="label">Điểm form tự nhập (tùy chọn)
                  <input className="input" type="number" min={0} max={100} value={logForm.accuracy} onChange={(e) => setLogForm({ ...logForm, accuracy: Number(e.target.value) })} />
                </label>
              </div>
              <button className="btn full" onClick={saveWorkout}>Lưu buổi tập</button>
              {coachKey(selected.name) ? <a className="btn secondary full" href={`/trueformcoach?exerciseId=${selected.id}`}>Mở bằng AI Coach</a> : <p className="small muted">Bài này ghi kết quả thủ công.</p>}
            </>
          ) : <p className="muted">Chọn một bài tập để ghi nhanh.</p>}
        </aside>
      </div>
    </section>
  );
}

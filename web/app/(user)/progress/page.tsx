"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Flame, Repeat, Target, TrendingUp } from "lucide-react";
import { api } from "@/services/api";
import type { WorkoutAnalysis, WorkoutSession } from "@/lib/types";

function dateKey(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function accuracyStatus(value: number) {
  if (!value) return "Chưa có dữ liệu";
  if (value >= 85) return "Tư thế tốt";
  if (value >= 70) return "Ổn, cần chỉnh thêm";
  return "Cần cải thiện form";
}

export default function ProgressPage() {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [analyses, setAnalyses] = useState<WorkoutAnalysis[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [w, a] = await Promise.all([api.workout.list().catch(() => []), api.analysis.list().catch(() => [])]);
      setWorkouts(w);
      setAnalyses(a);
    } catch (err: any) {
      setError(err?.message || "Không tải được tiến độ.");
    }
  }

  useEffect(() => { load(); }, []);

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; label: string; calories: number; reps: number; accuracy: number; count: number }>();
    for (const w of workouts) {
      const key = dateKey(w.date || w.performedAt);
      const item = map.get(key) || { date: key, label: dateLabel(key), calories: 0, reps: 0, accuracy: 0, count: 0 };
      item.calories += Number(w.caloriesBurned || 0);
      item.reps += Number(w.reps || 0);
      if (w.accuracyScore) { item.accuracy += Number(w.accuracyScore); item.count += 1; }
      map.set(key, item);
    }
    for (const a of analyses.filter((x) => !x.workoutSessionId)) {
      const key = dateKey(a.createdAt);
      const item = map.get(key) || { date: key, label: dateLabel(key), calories: 0, reps: 0, accuracy: 0, count: 0 };
      item.calories += Number(a.caloriesBurned || 0);
      item.reps += Number(a.totalReps || 0);
      if (a.accuracyScore) { item.accuracy += Number(a.accuracyScore); item.count += 1; }
      map.set(key, item);
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((x) => ({ ...x, accuracy: x.count ? Math.round(x.accuracy / x.count) : 0, calories: Math.round(x.calories) }));
  }, [workouts, analyses]);

  const recentWorkouts = useMemo(() => [...workouts].sort((a, b) => new Date(b.date || b.performedAt || 0).getTime() - new Date(a.date || a.performedAt || 0).getTime()).slice(0, 12), [workouts]);
  const totalCalories = chartData.reduce((s, x) => s + x.calories, 0);
  const totalReps = chartData.reduce((s, x) => s + x.reps, 0);
  const activeDays = chartData.filter((x) => x.reps > 0 || x.calories > 0).length;
  const accuracyDays = chartData.filter((x) => x.accuracy > 0);
  const avgAccuracy = accuracyDays.length ? Math.round(accuracyDays.reduce((s, x) => s + x.accuracy, 0) / accuracyDays.length) : 0;

  return (
    <section className="page stack">
      <div className="between">
        <div>
          <h1 className="page-title">Tiến độ</h1>
          <p className="page-subtitle">Nhìn nhanh xu hướng luyện tập: bạn đã tập mấy ngày, đốt bao nhiêu calories và tư thế đang cải thiện ra sao.</p>
        </div>
        <button className="btn secondary" onClick={load}>Làm mới</button>
      </div>
      {error && <div className="notice error">{error}</div>}

      <div className="grid">
        <div className="card col-3 kpi"><span className="row"><Flame size={17} /> Calories 14 ngày</span><strong>{totalCalories}</strong><p className="metric-note">Năng lượng đã tiêu hao.</p></div>
        <div className="card col-3 kpi"><span className="row"><Repeat size={17} /> Reps hợp lệ</span><strong>{totalReps}</strong><p className="metric-note">Chỉ tính reps được AI chấp nhận.</p></div>
        <div className="card col-3 kpi"><span className="row"><Target size={17} /> Điểm form TB</span><strong>{avgAccuracy}%</strong><p className="metric-note">{accuracyStatus(avgAccuracy)}.</p></div>
        <div className="card col-3 kpi"><span className="row"><Activity size={17} /> Ngày hoạt động</span><strong>{activeDays}</strong><p className="metric-note">Số ngày có dữ liệu tập.</p></div>
      </div>

      <div className="grid">
        <div className="card col-6 stack">
          <div>
            <h2 className="card-title">Mức vận động theo ngày</h2>
            <p className="metric-note">Cột càng cao nghĩa là ngày đó bạn vận động nhiều hơn. Hãy ưu tiên sự đều đặn trong 7-14 ngày thay vì cố đốt thật nhiều trong một ngày.</p>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(147,197,253,0.16)" />
                <XAxis dataKey="label" stroke="#93c5fd" tick={{ fill: "#93c5fd" }} />
                <YAxis stroke="#93c5fd" tick={{ fill: "#93c5fd" }} />
                <Tooltip formatter={(value) => [`${value} kcal`, "Calories"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""} />
                <Bar dataKey="calories" fill="#38bdf8" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-helper"><span>0 kcal: chưa có buổi tập</span><span>Nên theo dõi tối thiểu 7-14 ngày</span></div>
        </div>
        <div className="card col-6 stack">
          <div>
            <h2 className="card-title">Độ ổn định tư thế</h2>
            <p className="metric-note">Điểm càng cao nghĩa là tư thế càng gần chuẩn. Hãy giữ ổn định trên 85% rồi mới tăng tốc độ, số rep hoặc mức khó của bài tập.</p>
          </div>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(147,197,253,0.16)" />
                <XAxis dataKey="label" stroke="#93c5fd" tick={{ fill: "#93c5fd" }} />
                <YAxis domain={[0, 100]} stroke="#93c5fd" tick={{ fill: "#93c5fd" }} />
                <Tooltip formatter={(value) => [`${value}%`, "Điểm form"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.date || ""} />
                <Area type="monotone" dataKey="accuracy" stroke="#60a5fa" fill="rgba(96,165,250,0.28)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-helper"><span>85-100%: tốt</span><span>70-84%: cần chỉnh nhẹ</span><span>&lt;70%: ưu tiên sửa form</span></div>
        </div>
      </div>

      <div className="card stack">
        <div className="between">
          <h2 className="card-title row"><TrendingUp size={18} /> Nhật ký tập gần nhất</h2>
          <span className="badge blue">1 set = 12 reps hợp lệ</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Bài tập</th><th>Phút</th><th>Reps/Sets</th><th>Calories</th><th>Form</th><th>Ngày</th></tr></thead>
            <tbody>
              {recentWorkouts.map((w) => (
                <tr key={w.id}>
                  <td>{w.exerciseName}</td>
                  <td>{Math.round(Number(w.durationMinutes || 0))}</td>
                  <td>{w.reps}/{Math.floor(Number(w.reps || 0) / 12)}</td>
                  <td>{Math.round(Number(w.caloriesBurned || 0))}</td>
                  <td>{Math.round(Number(w.accuracyScore || 0))}% · {accuracyStatus(Number(w.accuracyScore || 0))}</td>
                  <td>{new Date(w.date || w.performedAt || "").toLocaleString("vi-VN")}</td>
                </tr>
              ))}
              {!recentWorkouts.length && <tr><td colSpan={6}>Chưa có buổi tập. Hãy vào AI Coach để bắt đầu ghi nhận tiến độ.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

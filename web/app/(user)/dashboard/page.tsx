"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Flame, Repeat, Target, Timer, TrendingUp } from "lucide-react";
import { api } from "@/services/api";
import type { WorkoutAnalysis, WorkoutSession } from "@/lib/types";

type DailyWorkoutEntry = {
  key: string;
  source: "analysis" | "workout";
  exerciseName: string;
  date: string;
  durationSeconds: number;
  reps: number;
  sets: number;
  calories: number;
  accuracy: number;
  feedback?: string | null;
};

function toDateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function entryDate(value?: string | null) {
  if (!value) return toDateInputValue();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toDateInputValue();
  return toDateInputValue(date);
}

function normalizeAnalysis(item: WorkoutAnalysis): DailyWorkoutEntry {
  const reps = Math.max(0, Number(item.totalReps || 0));
  return {
    key: `analysis-${item.id}`,
    source: "analysis",
    exerciseName: item.exerciseName || `Bài tập #${item.exerciseId}`,
    date: entryDate(item.createdAt),
    durationSeconds: Math.max(0, Number(item.durationInSeconds || 0)),
    reps,
    sets: Math.max(0, Number(item.totalSets || 0)),
    calories: Math.max(0, Number(item.caloriesBurned || 0)),
    accuracy: Math.max(0, Number(item.accuracyScore || 0)),
    feedback: item.feedbackSummary
  };
}

function normalizeWorkout(item: WorkoutSession): DailyWorkoutEntry {
  const reps = Math.max(0, Number(item.reps || 0));
  const durationSeconds = Math.max(0, Number(item.durationInSeconds || 0) || Number(item.durationMinutes || 0) * 60);
  return {
    key: `workout-${item.id}`,
    source: "workout",
    exerciseName: item.exerciseName || `Bài tập #${item.exerciseId}`,
    date: entryDate(item.performedAt || item.date),
    durationSeconds,
    reps,
    sets: Math.max(0, Number(item.sets || 0)),
    calories: Math.max(0, Number(item.caloriesBurned || 0)),
    accuracy: Math.max(0, Number(item.accuracyScore || 0)),
    feedback: "Buổi tập được ghi nhận."
  };
}

function accuracyLabel(value: number) {
  if (!value) return "Chưa có điểm form";
  if (value >= 85) return "Form đang rất tốt";
  if (value >= 70) return "Form ổn, cần chỉnh nhẹ";
  return "Nên ưu tiên sửa tư thế";
}

export default function DashboardPage() {
  const [entries, setEntries] = useState<DailyWorkoutEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [analyses, workouts] = await Promise.all([
        api.analysis.list().catch(() => [] as WorkoutAnalysis[]),
        api.workout.list().catch(() => [] as WorkoutSession[])
      ]);

      const analysisWorkoutIds = new Set(
        analyses
          .map((item) => item.workoutSessionId)
          .filter((id): id is number => typeof id === "number" && id > 0)
      );

      const analysisEntries = analyses.map(normalizeAnalysis);
      const standaloneWorkoutEntries = workouts
        .filter((item) => !analysisWorkoutIds.has(item.id))
        .map(normalizeWorkout);

      setEntries([...analysisEntries, ...standaloneWorkoutEntries].filter((item) => item.durationSeconds > 0 || item.reps > 0));
    } catch (err: any) {
      setError(err?.message || "Không tải được Dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const dailyEntries = useMemo(
    () => entries.filter((item) => item.date === selectedDate).sort((a, b) => b.key.localeCompare(a.key)),
    [entries, selectedDate]
  );

  const summary = useMemo(() => {
    const totalReps = dailyEntries.reduce((sum, item) => sum + item.reps, 0);
    const totalDurationSeconds = Math.round(dailyEntries.reduce((sum, item) => sum + item.durationSeconds, 0));
    const accuracyItems = dailyEntries.filter((item) => item.accuracy > 0);
    return {
      totalWorkouts: dailyEntries.length,
      caloriesBurned: dailyEntries.reduce((sum, item) => sum + item.calories, 0),
      totalMinutes: Math.floor(totalDurationSeconds / 60),
      totalSecondsRemainder: totalDurationSeconds % 60,
      totalReps,
      totalSets: dailyEntries.reduce((sum, item) => sum + item.sets, 0),
      averageAccuracy: accuracyItems.length ? Math.round((accuracyItems.reduce((sum, item) => sum + item.accuracy, 0) / accuracyItems.length) * 10) / 10 : 0
    };
  }, [dailyEntries]);

  const workoutDays = useMemo(() => new Set(entries.map((item) => item.date)).size, [entries]);

  return (
    <section className="page stack">
      <div className="between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Tổng hợp số lần lặp, thời gian và điểm tư thế theo ngày tập.</p>
        </div>
        <div className="row">
          <label className="label" style={{ minWidth: 180 }}>Ngày tập
            <input className="input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </label>
          <button className="btn secondary" onClick={load}>Làm mới</button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {loading && <div className="card">Đang tải dữ liệu...</div>}

      {!loading && (
        <>
          <div className="grid">
            {[
              { label: "Buổi tập trong ngày", value: summary.totalWorkouts, icon: <Activity />, note: "Số phiên đã lưu trong ngày chọn." },
              { label: "Ngày đã tập", value: workoutDays, icon: <CalendarDays />, note: "Tổng số ngày có hoạt động." },
              { label: "Calories đốt", value: Math.round(summary.caloriesBurned), icon: <Flame />, note: "Ước tính theo bài tập và thời gian." },
              { label: "Tổng thời gian", value: `${summary.totalMinutes}:${String(summary.totalSecondsRemainder).padStart(2, "0")}`, icon: <Timer />, note: "Thời gian tập thực tế." },
              { label: "Tổng reps", value: summary.totalReps, icon: <Repeat />, note: "Số rep đã lưu trong lịch sử." },
              { label: "Tổng hiệp", value: summary.totalSets, icon: <Target />, note: "Cộng số hiệp đã lưu của từng buổi." },
              { label: "Điểm form TB", value: `${summary.averageAccuracy || 0}%`, icon: <TrendingUp />, note: accuracyLabel(summary.averageAccuracy) }
            ].map((kpi) => (
              <div className="card col-4 kpi" key={kpi.label}>
                <span className="row">{kpi.icon} {kpi.label}</span>
                <strong>{kpi.value}</strong>
                <p className="metric-note">{kpi.note}</p>
              </div>
            ))}
          </div>

          <div className="card stack">
            <div className="between">
              <div>
                <h2 className="card-title">Buổi tập ngày {new Date(selectedDate).toLocaleDateString("vi-VN")}</h2>
                <p className="metric-note">Mỗi dòng là một bài đã được lưu. Hãy xem feedback để biết tư thế cần cải thiện.</p>
              </div>
              
            </div>
            <div className="stack">
              {dailyEntries.length ? dailyEntries.map((item) => (
                <div className="card soft" key={item.key}>
                  <div className="between">
                    <strong>{item.exerciseName}</strong>
                    <span className="badge blue">{Math.round(item.accuracy || 0)}% form</span>
                  </div>
                  <p className="muted small">{item.feedback || "Đã lưu kết quả tập luyện."}</p>
                  <div className="row small muted">
                    <span>{item.reps} reps</span>
                    <span>{item.sets} sets</span>
                    
                    <span>{Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, "0")}</span>
                    <span>{Math.round(item.calories || 0)} kcal</span>
                  </div>
                </div>
              )) : <p className="muted">Ngày này chưa có buổi tập hợp lệ. Vào AI Coach, bấm bắt đầu, tập đúng form rồi kết thúc & lưu.</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

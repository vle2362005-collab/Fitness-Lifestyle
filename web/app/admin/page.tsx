"use client";

import { useEffect, useState } from "react";
import { Activity, Brain, Dumbbell, Flame, Utensils, Users } from "lucide-react";
import { api } from "@/services/api";
import type { AdminStats } from "@/lib/types";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try { setStats(await api.admin.stats()); }
    catch (err: any) { setError(err?.message || "Không tải được thống kê admin."); }
  }
  useEffect(() => { load(); }, []);

  const cards = [
    { label: "Người dùng", value: stats?.totalUsers || 0, icon: <Users /> },
    { label: "Bài tập", value: stats?.totalExercises || 0, icon: <Dumbbell /> },
    { label: "Workout", value: stats?.totalWorkoutSessions || 0, icon: <Activity /> },
    { label: "AI Analyses", value: stats?.totalAnalyses || 0, icon: <Brain /> },
    { label: "Nutrition Logs", value: stats?.totalNutritionLogs || 0, icon: <Utensils /> },
    { label: "Calories Burned", value: Math.round(stats?.totalCaloriesBurned || 0), icon: <Flame /> }
  ];

  return (
    <section className="page stack">
      <div className="between">
        <div><h1 className="page-title">Admin tổng quan</h1><p className="page-subtitle">Theo dõi hoạt động tập luyện, phân tích AI và dinh dưỡng của toàn hệ thống.</p></div>
        <button className="btn secondary" onClick={load}>Làm mới</button>
      </div>
      {error && <div className="notice error">{error}</div>}
      <div className="grid">
        {cards.map((c) => <div className="card col-4 kpi" key={c.label}><span className="row">{c.icon} {c.label}</span><strong>{c.value}</strong></div>)}
      </div>
      <div className="card stack">
        <h2 className="card-title">Trọng tâm hệ thống</h2>
        <p className="metric-note">Giai đoạn này tập trung vào AI Coach, theo dõi tiến độ và dinh dưỡng cá nhân hóa. Các số liệu quản trị giúp bạn kiểm tra dữ liệu người dùng, bài tập, phiên phân tích và nhật ký ăn uống.</p>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Apple, Bot, CalendarDays, CheckCircle2, Dumbbell, Flame, Info, Plus, Scale, Search, Sparkles, Target, Trash2, Utensils } from "lucide-react";
import { api } from "@/services/api";
import type { Food, MedicalProfile, NutritionSummary, WorkoutAnalysis, WorkoutSession } from "@/lib/types";
import {
  buildNutritionCoach,
  dateInputValue,
  macroStatus,
  mealLabel,
  MEAL_TYPES,
  pct,
  round,
  scoreLabel
} from "@/lib/nutritionCoach";

function messageIcon(type: string) {
  if (type === "success") return <CheckCircle2 size={17} />;
  if (type === "danger" || type === "warning") return <AlertTriangle size={17} />;
  return <Info size={17} />;
}

function messageClass(type: string) {
  if (type === "success") return "notice";
  if (type === "danger") return "notice error";
  if (type === "warning") return "notice warn";
  return "notice";
}

function formatDelta(value: number, unit: string) {
  if (value > 0) return `Còn ${round(value, unit === "kcal" ? 0 : 1)} ${unit}`;
  if (value < 0) return `Vượt ${round(Math.abs(value), unit === "kcal" ? 0 : 1)} ${unit}`;
  return `Đủ ${unit}`;
}

export default function NutritionPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [profile, setProfile] = useState<MedicalProfile | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [analyses, setAnalyses] = useState<WorkoutAnalysis[]>([]);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(dateInputValue());
  const [form, setForm] = useState({ foodId: 0, quantity: 1, mealType: 3 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const [foodItems, sum, p, w, a] = await Promise.all([
        api.nutrition.foods(search),
        api.nutrition.summary(date),
        api.profile.get().catch(() => null),
        api.workout.list().catch(() => [] as WorkoutSession[]),
        api.analysis.list().catch(() => [] as WorkoutAnalysis[])
      ]);
      setFoods(foodItems);
      setSummary(sum);
      setProfile(p);
      setWorkouts(w);
      setAnalyses(a);
      setForm((prev) => ({ ...prev, foodId: prev.foodId || foodItems[0]?.id || 0 }));
    } catch (err: any) {
      setError(err?.message || "Không tải được dữ liệu dinh dưỡng.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [date]);

  const selectedFood = useMemo(() => foods.find((f) => f.id === form.foodId), [foods, form.foodId]);

  const coach = useMemo(() => buildNutritionCoach({ profile, summary, foods, date, workouts, analyses }), [profile, summary, foods, date, workouts, analyses]);

  async function logFood(custom?: { foodId: number; quantity?: number; mealType?: number }) {
    const payload = {
      foodId: custom?.foodId ?? form.foodId,
      quantity: custom?.quantity ?? form.quantity,
      mealType: custom?.mealType ?? form.mealType
    };
    if (!payload.foodId) return setError("Vui lòng chọn món ăn.");
    if (payload.quantity <= 0) return setError("Số khẩu phần phải lớn hơn 0.");
    setMessage(""); setError("");
    try {
      const res = await api.nutrition.log({ ...payload, date });
      setMessage(res.message || "Đã lưu bữa ăn.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Không lưu được bữa ăn.");
    }
  }

  async function removeLog(id: number) {
    if (!confirm("Xóa nhật ký món ăn này?")) return;
    await api.nutrition.remove(id);
    await load();
  }

  const macroRows = [
    { label: "Calories", value: coach.totals.calories, target: coach.target.calories, min: coach.target.calories * 0.9, max: coach.target.calories * 1.1, unit: "kcal", icon: <Flame size={16} /> },
    { label: "Protein", value: coach.totals.protein, target: coach.target.protein, min: coach.target.proteinMin, max: coach.target.proteinMax, unit: "g", icon: <Dumbbell size={16} /> },
    { label: "Carbs", value: coach.totals.carbs, target: coach.target.carbs, min: coach.target.carbsMin, max: coach.target.carbsMax, unit: "g", icon: <Apple size={16} /> },
    { label: "Fat", value: coach.totals.fat, target: coach.target.fat, min: coach.target.fatMin, max: coach.target.fatMax, unit: "g", icon: <Scale size={16} /> }
  ];

  return (
    <section className="page stack">
      <div className="between">
        <div>
          <h1 className="page-title">Dinh dưỡng AI Coach</h1>
          <p className="page-subtitle">Admin thêm món ăn trong trang quản trị; người dùng chọn món, ghi khẩu phần và hệ thống tự tính calories, macro, bữa nào đang thiếu/dư để hỗ trợ vóc dáng.</p>
        </div>
        <div className="row">
          <label className="label" style={{ minWidth: 180 }}>Ngày theo dõi
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className="btn secondary" onClick={load}>Làm mới</button>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      {loading && <div className="card">Đang phân tích dinh dưỡng...</div>}

      {!loading && (
        <>
          <div className="grid">
            <div className="card col-3 kpi">
              <span className="row"><Target size={17} /> Mục tiêu ngày</span>
              <strong>{coach.target.calories} kcal</strong>
              <p className="metric-note">{coach.target.goalLabel}. {coach.target.hasProfile ? "Tính từ TDEE trong hồ sơ." : "Đang dùng mục tiêu mặc định."}</p>
            </div>
            <div className="card col-3 kpi">
              <span className="row"><Flame size={17} /> Đã nạp</span>
              <strong>{coach.totals.calories} kcal</strong>
              <p className="metric-note">{formatDelta(coach.remaining.calories, "kcal")} so với mục tiêu.</p>
            </div>
            <div className="card col-3 kpi">
              <span className="row"><Dumbbell size={17} /> Protein</span>
              <strong>{coach.totals.protein}/{coach.target.protein}g</strong>
              <p className="metric-note">{formatDelta(coach.remaining.protein, "g")}. Đây là macro quan trọng để giữ/tăng cơ.</p>
            </div>
            <div className="card col-3 kpi">
              <span className="row"><Sparkles size={17} /> Điểm cân bằng</span>
              <strong>{coach.score}/100</strong>
              <p className="metric-note">{scoreLabel(coach.score)}.</p>
            </div>
          </div>

          <div className="grid">
            <div className="card col-7 stack">
              <div className="between">
                <div>
                  <h2 className="card-title row"><Bot size={18} /> AI Nutrition Coach hôm nay</h2>
                  <p className="metric-note">Các gợi ý được tính ngay trên frontend từ hồ sơ, nhật ký ăn uống, món ăn Admin đã nhập và dữ liệu tập trong ngày.</p>
                </div>
                <span className="badge blue">Nước gợi ý: {coach.target.waterMl} ml/ngày</span>
              </div>
              <div className="stack">
                {coach.messages.map((item, index) => (
                  <div className={messageClass(item.type)} key={`${item.title}-${index}`}>
                    <div className="row"><strong className="row">{messageIcon(item.type)} {item.title}</strong></div>
                    <p className="metric-note" style={{ marginTop: 6 }}>{item.text}</p>
                  </div>
                ))}
              </div>
              {coach.trainingMinutesToday > 0 && (
                <div className="card soft row">
                  <Dumbbell size={18} />
                  <div>
                    <strong>Có hoạt động tập luyện trong ngày</strong>
                    <p className="metric-note">Đã tập khoảng {coach.trainingMinutesToday} phút, đốt ước tính {coach.trainingCaloriesToday} kcal. Sau tập nên ưu tiên protein + carb tốt để phục hồi.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="card col-5 stack">
              <h2 className="card-title row"><Utensils size={18} /> Ghi bữa ăn</h2>
              <div className="form-grid">
                <label className="label">Tìm món
                  <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Ức gà, cơm, trứng..." />
                </label>
                <label className="label">Bữa
                  <select className="select" value={form.mealType} onChange={(e) => setForm({ ...form, mealType: Number(e.target.value) })}>
                    {MEAL_TYPES.map((m) => <option key={m.value} value={m.value}>{m.shortLabel}</option>)}
                  </select>
                </label>
              </div>
              <button className="btn secondary" onClick={load}><Search size={16} /> Tìm món</button>
              <label className="label">Món ăn
                <select className="select" value={form.foodId} onChange={(e) => setForm({ ...form, foodId: Number(e.target.value) })}>
                  {foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}
                </select>
              </label>
              {selectedFood ? (
                <div className="card soft small">
                  <strong>{selectedFood.name}</strong>
                  <p className="metric-note">1 khẩu phần: {selectedFood.calories} kcal · Protein {selectedFood.protein}g · Carb {selectedFood.carbs}g · Fat {selectedFood.fat}g</p>
                </div>
              ) : (
                <div className="notice warn">Chưa có món ăn phù hợp. Admin cần thêm món trong trang quản trị trước.</div>
              )}
              <label className="label">Số khẩu phần
                <input className="input" type="number" min="0.1" step="0.1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </label>
              <button className="btn full" onClick={() => logFood()}><Plus size={16} /> Lưu bữa ăn</button>
            </div>
          </div>

          <div className="grid">
            <div className="card col-6 stack">
              <h2 className="card-title row"><Scale size={18} /> Macro trong ngày</h2>
              {macroRows.map((x) => (
                <div key={x.label} className="macro-row">
                  <div className="macro-head">
                    <span className="row">{x.icon} {x.label}</span>
                    <span>{round(Number(x.value), x.unit === "kcal" ? 0 : 1)}/{round(x.target, 0)} {x.unit} · {macroStatus(Number(x.value), x.min, x.max)}</span>
                  </div>
                  <div className="progress-bar"><span style={{ ["--value" as any]: `${pct(Number(x.value), x.target)}%` }} /></div>
                  <p className="metric-note">Vùng hợp lý: {round(x.min, 0)} - {round(x.max, 0)} {x.unit}</p>
                </div>
              ))}
            </div>

            <div className="card col-6 stack">
              <h2 className="card-title row"><CalendarDays size={18} /> Phân bổ theo bữa</h2>
              {coach.mealProgress.map((meal) => (
                <div className="macro-row" key={meal.value}>
                  <div className="macro-head">
                    <span>{meal.label} <span className="muted small">· {meal.role}</span></span>
                    <span>{meal.calories}/{meal.targetCalories} kcal</span>
                  </div>
                  <div className="progress-bar"><span style={{ ["--value" as any]: `${meal.percent}%` }} /></div>
                  <p className="metric-note">
                    {meal.status === "balanced" ? "Bữa này đang cân bằng." : meal.status === "missing" ? `Còn thiếu khoảng ${Math.max(0, meal.delta)} kcal.` : `Đã vượt khoảng ${Math.abs(meal.delta)} kcal.`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card stack">
            <div className="between">
              <div>
                <h2 className="card-title row"><Sparkles size={18} /> Món nên thêm từ danh sách Admin</h2>
                <p className="metric-note">Frontend tự chọn món phù hợp với phần macro/calories còn thiếu. Admin chỉ cần nhập món một lần, người dùng sẽ chọn và ghi khẩu phần.</p>
              </div>
              <span className="badge blue">Gợi ý theo ngày đang xem</span>
            </div>
            <div className="grid">
              {coach.recommendations.map((item) => (
                <div className="card soft col-4 stack" key={item.food.id}>
                  <div>
                    <strong>{item.food.name}</strong>
                    <p className="metric-note">{item.reason} · gợi ý {item.suggestedQuantity} khẩu phần cho bữa {mealLabel(item.targetMeal)}</p>
                  </div>
                  <div className="row small muted">
                    <span>{item.food.calories} kcal</span>
                    <span>P {item.food.protein}g</span>
                    <span>C {item.food.carbs}g</span>
                    <span>F {item.food.fat}g</span>
                  </div>
                  <button className="btn secondary" onClick={() => logFood({ foodId: item.food.id, quantity: item.suggestedQuantity, mealType: item.targetMeal })}>
                    <Plus size={15} /> Thêm nhanh
                  </button>
                </div>
              ))}
              {!coach.recommendations.length && <div className="notice warn col-12">Chưa có đủ món ăn để gợi ý. Admin hãy thêm các món cơ bản như cơm, ức gà, trứng, cá, sữa, chuối, khoai, rau, đậu phụ...</div>}
            </div>
          </div>

          <div className="card stack">
            <h2 className="card-title row"><Utensils size={18} /> Nhật ký trong ngày</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Món</th><th>Bữa</th><th>Khẩu phần</th><th>Kcal</th><th>Macro</th><th></th></tr></thead>
                <tbody>
                  {summary?.logs?.map((log) => (
                    <tr key={log.id}>
                      <td><strong>{log.foodName || log.food?.name}</strong></td>
                      <td>{mealLabel(log.mealType)}</td>
                      <td>{log.quantity}</td>
                      <td>{Math.round(Number(log.calories || 0))}</td>
                      <td>P {round(Number(log.protein || 0), 1)}g · C {round(Number(log.carbs || 0), 1)}g · F {round(Number(log.fat || 0), 1)}g</td>
                      <td><button className="btn danger" onClick={() => removeLog(log.id)}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                  {!summary?.logs?.length && <tr><td colSpan={6}>Chưa ghi món ăn trong ngày này.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

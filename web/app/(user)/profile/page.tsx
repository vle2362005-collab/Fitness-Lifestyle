"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, Flame, HeartPulse, Info, Save, Scale, Target } from "lucide-react";
import { api } from "@/services/api";

const genderOptions = [
  { value: 0, label: "Nam" },
  { value: 1, label: "Nữ" },
  { value: 2, label: "Khác" }
];
const activityOptions = [
  { value: 0, label: "Ít vận động", factor: "1.2" },
  { value: 1, label: "Nhẹ", factor: "1.375" },
  { value: 2, label: "Vừa", factor: "1.55" },
  { value: 3, label: "Nhiều", factor: "1.725" },
  { value: 4, label: "Rất nhiều", factor: "1.9" }
];
const goalOptions = [
  { value: 0, label: "Giảm cân", note: "TDEE - 500 kcal/ngày" },
  { value: 1, label: "Duy trì", note: "Giữ theo TDEE vận động" },
  { value: 2, label: "Tăng cơ", note: "TDEE + 300 kcal/ngày" }
];

function enumToNumber(value: string | number | undefined, values: string[]): number {
  if (typeof value === "number") return value;
  const index = values.findIndex((x) => x.toLowerCase() === String(value || "").toLowerCase());
  return index >= 0 ? index : 0;
}

function bmiStatus(bmi: number) {
  if (!bmi) return "Chưa có dữ liệu";
  if (bmi < 18.5) return "Thiếu cân";
  if (bmi < 23) return "Cân đối theo chuẩn châu Á";
  if (bmi < 25) return "Hơi thừa cân";
  if (bmi < 30) return "Thừa cân";
  return "Béo phì";
}

export default function ProfilePage() {
  const [form, setForm] = useState({ height: 170, weight: 65, age: 22, gender: 0, activityLevel: 2, goal: 1 });
  const [metrics, setMetrics] = useState({ bmi: 0, bmr: 0, tdee: 0 });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.profile.get().then((p) => {
      setForm({
        height: p.height,
        weight: p.weight,
        age: p.age,
        gender: enumToNumber(p.gender, ["Male", "Female", "Other"]),
        activityLevel: enumToNumber(p.activityLevel, ["Sedentary", "LightlyActive", "ModeratelyActive", "VeryActive", "ExtraActive"]),
        goal: enumToNumber(p.goal, ["WeightLoss", "Maintenance", "MuscleGain"])
      });
      setMetrics({ bmi: p.bmi, bmr: p.bmr, tdee: p.tdee });
    }).catch(() => setError("Bạn chưa cập nhật hồ sơ sức khỏe. Hãy nhập thông tin để hệ thống tính mục tiêu luyện tập và dinh dưỡng."));
  }, []);

  const selectedActivity = useMemo(() => activityOptions.find((x) => x.value === form.activityLevel) || activityOptions[0], [form.activityLevel]);
  const selectedGoal = useMemo(() => goalOptions.find((x) => x.value === form.goal) || goalOptions[1], [form.goal]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(""); setMessage("");
    try {
      const res = await api.profile.upsert(form);
      setMetrics({ bmi: res.profile.bmi, bmr: res.profile.bmr, tdee: res.profile.tdee });
      setMessage(res.message || "Đã lưu hồ sơ sức khỏe.");
    } catch (err: any) {
      setError(err?.message || "Không lưu được hồ sơ.");
    }
  }

  return (
    <section className="page stack">
      <div>
        <h1 className="page-title">Hồ sơ sức khỏe</h1>
        <p className="page-subtitle">Thông tin này là nền để AI Coach và Dinh dưỡng tính mục tiêu phù hợp: tập đúng tư thế, ăn đủ năng lượng và cải thiện vóc dáng theo thời gian.</p>
      </div>
      {message && <div className="notice">{message}</div>}
      {error && <div className="notice warn">{error}</div>}

      <div className="grid">
        <form className="card col-7 stack" onSubmit={save}>
          <h2 className="card-title row"><HeartPulse size={18} /> Thông tin cơ bản</h2>
          <div className="form-grid">
            <label className="label">Chiều cao cm<input className="input" type="number" min={50} max={250} value={form.height} onChange={(e) => setForm({ ...form, height: Number(e.target.value) })} /></label>
            <label className="label">Cân nặng kg<input className="input" type="number" min={30} max={300} value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} /></label>
            <label className="label">Tuổi<input className="input" type="number" min={10} max={100} value={form.age} onChange={(e) => setForm({ ...form, age: Number(e.target.value) })} /></label>
            <label className="label">Giới tính<select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: Number(e.target.value) })}>{genderOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label className="label">Mức vận động<select className="select" value={form.activityLevel} onChange={(e) => setForm({ ...form, activityLevel: Number(e.target.value) })}>{activityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
            <label className="label">Mục tiêu<select className="select" value={form.goal} onChange={(e) => setForm({ ...form, goal: Number(e.target.value) })}>{goalOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          </div>
          <div className="health-formula">
            <strong className="row"><Info size={16} /> Công thức hệ thống đang dùng</strong>
            <p className="metric-note">BMI = cân nặng / (chiều cao theo mét)². BMR dùng công thức Mifflin-St Jeor. Nam: 10×kg + 6.25×cm − 5×tuổi + 5. Nữ: 10×kg + 6.25×cm − 5×tuổi − 161. TDEE = BMR × hệ số vận động ({selectedActivity.factor}), sau đó điều chỉnh theo mục tiêu: {selectedGoal.note}.</p>
          </div>
          <button className="btn"><Save size={16} /> Lưu hồ sơ</button>
        </form>

        <div className="col-5 stack">
          <div className="card kpi">
            <span className="row"><Scale size={17} /> BMI - chỉ số cân nặng/chiều cao</span>
            <strong>{Number(metrics.bmi || 0).toFixed(1)}</strong>
            <p className="metric-note">{bmiStatus(Number(metrics.bmi || 0))}. BMI giúp nhìn nhanh tình trạng vóc dáng, nhưng không thay thế đo tỷ lệ mỡ/cơ.</p>
          </div>
          <div className="card kpi">
            <span className="row"><Flame size={17} /> BMR - năng lượng nền</span>
            <strong>{Math.round(metrics.bmr || 0)} kcal</strong>
            <p className="metric-note">Lượng calories cơ thể ước tính cần để duy trì các hoạt động sống cơ bản khi nghỉ ngơi.</p>
          </div>
          <div className="card kpi">
            <span className="row"><Target size={17} /> TDEE mục tiêu</span>
            <strong>{Math.round(metrics.tdee || 0)} kcal</strong>
            <p className="metric-note">Mốc calories/ngày để mục Dinh dưỡng so sánh bạn đang ăn thiếu, đủ hay vượt so với mục tiêu vóc dáng.</p>
          </div>
          <div className="card soft">
            <strong className="row"><Activity size={16} /> Lưu ý sử dụng</strong>
            <p className="metric-note">Các chỉ số là ước tính để theo dõi xu hướng. Hãy cập nhật cân nặng định kỳ để khẩu phần và mục tiêu tập luyện được sát hơn.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

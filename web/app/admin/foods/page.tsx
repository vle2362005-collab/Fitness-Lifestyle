"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, Pencil, PlusCircle, Save, Trash2, Utensils } from "lucide-react";
import { api } from "@/services/api";
import type { Food } from "@/lib/types";

const emptyFood = { name: "", calories: 0, protein: 0, carbs: 0, fat: 0, imageUrl: "" };

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function macroCalories(food: Partial<Food>) {
  return numberValue(food.protein) * 4 + numberValue(food.carbs) * 4 + numberValue(food.fat) * 9;
}

function foodQualityNote(food: Partial<Food>) {
  const kcal = numberValue(food.calories);
  const estimated = macroCalories(food);
  if (!food.name || !kcal) return { type: "info", text: "Nhập dữ liệu theo 1 khẩu phần tiêu chuẩn để người dùng chọn nhanh khi ghi bữa ăn." };
  const diff = Math.abs(kcal - estimated);
  const diffPct = kcal ? diff / kcal : 0;
  if (diffPct > 0.28) return { type: "warning", text: `Calories từ macro đang lệch khá nhiều: P/C/F ước tính ${Math.round(estimated)} kcal, bạn nhập ${kcal} kcal. Nên kiểm tra lại khẩu phần.` };
  return { type: "success", text: `Dữ liệu ổn: P/C/F ước tính khoảng ${Math.round(estimated)} kcal so với ${kcal} kcal đã nhập.` };
}

export default function AdminFoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [form, setForm] = useState<Partial<Food>>(emptyFood);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try { setFoods(await api.foods.list(search)); }
    catch (err: any) { setError(err?.message || "Không tải được món ăn."); }
  }
  useEffect(() => { load(); }, []);

  const quality = useMemo(() => foodQualityNote(form), [form]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMessage(""); setError("");
    try {
      const payload = {
        ...form,
        calories: numberValue(form.calories),
        protein: numberValue(form.protein),
        carbs: numberValue(form.carbs),
        fat: numberValue(form.fat),
        imageUrl: form.imageUrl || ""
      };
      const res = form.id ? await api.foods.update(form.id, payload) : await api.foods.create(payload);
      setMessage(res.message || "Đã lưu món ăn.");
      setForm(emptyFood);
      await load();
    } catch (err: any) { setError(err?.message || "Không lưu được món ăn."); }
  }

  async function remove(id: number) {
    if (!confirm("Xóa món ăn này? Người dùng sẽ không chọn được món này trong nhật ký dinh dưỡng.")) return;
    try { await api.foods.remove(id); await load(); }
    catch (err: any) { setError(err?.message || "Không xóa được món ăn."); }
  }

  return (
    <section className="page stack">
      <div>
        <h1 className="page-title">Quản lý món ăn</h1>
        <p className="page-subtitle">Bạn là người thêm món thủ công. Frontend sẽ dùng danh sách này để người dùng ghi khẩu phần, tính calories/macro và nhận gợi ý dinh dưỡng AI Coach.</p>
      </div>
      {message && <div className="notice">{message}</div>}{error && <div className="notice error">{error}</div>}

      <div className="grid">
        <form className="card col-7 stack" onSubmit={submit}>
          <div className="between">
            <h2 className="card-title row"><PlusCircle size={18} /> {form.id ? "Cập nhật món" : "Thêm món mới"}</h2>
            {form.id && <button type="button" className="btn ghost" onClick={() => setForm(emptyFood)}>Hủy sửa</button>}
          </div>
          <div className="form-grid">
            <label className="label">Tên món / 1 khẩu phần
              <input className="input" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Ức gà áp chảo 100g" />
            </label>
            <label className="label">Calories / khẩu phần
              <input className="input" type="number" min={0} value={form.calories || 0} onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })} />
            </label>
            <label className="label">Protein g
              <input className="input" type="number" min={0} step="0.1" value={form.protein || 0} onChange={(e) => setForm({ ...form, protein: Number(e.target.value) })} />
            </label>
            <label className="label">Carbs g
              <input className="input" type="number" min={0} step="0.1" value={form.carbs || 0} onChange={(e) => setForm({ ...form, carbs: Number(e.target.value) })} />
            </label>
            <label className="label">Fat g
              <input className="input" type="number" min={0} step="0.1" value={form.fat || 0} onChange={(e) => setForm({ ...form, fat: Number(e.target.value) })} />
            </label>
            <label className="label">Image URL nếu có
              <input className="input" value={form.imageUrl || ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Có thể bỏ trống" />
            </label>
          </div>
          <div className={quality.type === "warning" ? "notice warn" : "notice"}>
            <div className="row"><strong>{quality.type === "warning" ? <AlertTriangle size={16} /> : <Info size={16} />} Kiểm tra nhanh dữ liệu</strong></div>
            <p className="metric-note" style={{ marginTop: 6 }}>{quality.text}</p>
          </div>
          <button className="btn"><Save size={16} /> Lưu món ăn</button>
        </form>

        <div className="card col-5 stack">
          <h2 className="card-title row"><Utensils size={18} /> Gợi ý nhập dữ liệu</h2>
          <div className="stack">
            <div className="card soft">
              <strong>Ưu tiên nhập món cơ bản trước</strong>
              <p className="metric-note">Cơm, trứng, ức gà, thịt bò nạc, cá, sữa, chuối, khoai lang, yến mạch, rau, đậu phụ. Đây là nhóm món giúp AI Coach gợi ý dễ hơn.</p>
            </div>
            <div className="card soft">
              <strong>Nhập theo 1 khẩu phần rõ ràng</strong>
              <p className="metric-note">Ví dụ: “Ức gà 100g”, “Cơm trắng 1 chén”, “Chuối 1 quả”. Người dùng sẽ tăng/giảm số khẩu phần khi ghi bữa ăn.</p>
            </div>
            <div className="card soft">
              <strong>Macro nên gần đúng</strong>
              <p className="metric-note">Protein và carbs tính 4 kcal/g, fat tính 9 kcal/g. Nếu lệch quá nhiều, gợi ý dinh dưỡng sẽ kém chính xác.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="between">
          <h2 className="card-title">Danh sách món ăn</h2>
          <div className="row"><input className="input" style={{ width: 260 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm món" /><button className="btn secondary" onClick={load}>Tìm</button></div>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Tên</th><th>Kcal</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Độ khớp kcal</th><th></th></tr></thead><tbody>
          {foods.map((f) => {
            const estimated = macroCalories(f);
            const diff = Math.abs(numberValue(f.calories) - estimated);
            return <tr key={f.id}>
              <td><strong>{f.name}</strong></td>
              <td>{f.calories}</td>
              <td>{f.protein}g</td>
              <td>{f.carbs}g</td>
              <td>{f.fat}g</td>
              <td>{Math.round(estimated)} kcal từ macro {diff > f.calories * 0.28 ? <span className="badge yellow">Kiểm tra</span> : <span className="badge blue">Ổn</span>}</td>
              <td className="row"><button className="btn secondary" onClick={() => setForm(f)}><Pencil size={15} /></button><button className="btn danger" onClick={() => remove(f.id)}><Trash2 size={15} /></button></td>
            </tr>;
          })}
          {!foods.length && <tr><td colSpan={7}>Chưa có món ăn. Hãy thêm món đầu tiên để người dùng bắt đầu ghi nhật ký dinh dưỡng.</td></tr>}
        </tbody></table></div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({ username: "", fullName: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await register(form);
      setMessage("Đăng ký thành công. Đang chuyển sang đăng nhập...");
      setTimeout(() => router.push("/login"), 700);
    } catch (err: any) {
      setError(err?.message || "Đăng ký thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="card auth-card stack" onSubmit={handleSubmit}>
        <div>
          <h1 className="card-title">Tạo tài khoản mới</h1>
          <p className="muted small">Tạo tài khoản để lưu hồ sơ sức khỏe, tiến độ tập luyện và nhật ký dinh dưỡng.</p>
        </div>
        {message && <div className="notice">{message}</div>}
        {error && <div className="notice error">{error}</div>}
        <label className="label">Username
          <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        </label>
        <label className="label">Họ tên
          <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </label>
        <label className="label">Email
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="label">Mật khẩu
          <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        </label>
        <button className="btn full" disabled={loading}>{loading ? "Đang tạo..." : "Đăng ký"}</button>
        <p className="muted small">Đã có tài khoản? <Link href="/login"><strong>Đăng nhập</strong></Link></p>
      </form>
    </main>
  );
}

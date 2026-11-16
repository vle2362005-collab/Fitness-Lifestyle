"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Dumbbell } from "lucide-react";
import { useAuth } from "@/app/components/AuthProvider";
import { isAdminRole } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await login(usernameOrEmail, password);
      router.push(isAdminRole(session.role) ? "/admin" : "/dashboard");
    } catch (err: any) {
      setError(err?.message || "Đăng nhập thất bại. Vui lòng kiểm tra tài khoản hoặc thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="card auth-card stack" onSubmit={handleSubmit}>
        <div className="row">
          <span className="logo-mark"><Dumbbell size={20} /></span>
          <div>
            <h1 className="card-title">Đăng nhập</h1>
            <p className="muted small">Tiếp tục hành trình tập luyện và dinh dưỡng cá nhân hóa.</p>
          </div>
        </div>
        {error && <div className="notice error">{error}</div>}
        <label className="label">Username hoặc email
          <input className="input" value={usernameOrEmail} onChange={(e) => setUsernameOrEmail(e.target.value)} placeholder="admin hoặc email" />
        </label>
        <label className="label">Mật khẩu
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" />
        </label>
        <button className="btn full" disabled={loading}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        <p className="muted small">Chưa có tài khoản? <Link href="/register"><strong>Đăng ký</strong></Link></p>
      </form>
    </main>
  );
}

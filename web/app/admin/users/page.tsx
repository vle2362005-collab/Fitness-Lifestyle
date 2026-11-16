"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Trash2, UserCog } from "lucide-react";
import { api, isAdminRole } from "@/services/api";
import type { AdminUser } from "@/lib/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try { setUsers(await api.admin.users(search)); }
    catch (err: any) { setError(err?.message || "Không tải được người dùng."); }
  }
  useEffect(() => { load(); }, []);

  async function updateRole(id: number, role: 0 | 1) {
    setMessage(""); setError("");
    try { const res = await api.admin.updateRole(id, role); setMessage(res.message); await load(); }
    catch (err: any) { setError(err?.message || "Không đổi được quyền."); }
  }

  async function remove(id: number) {
    if (!confirm("Xóa người dùng này và dữ liệu liên quan?")) return;
    try { const res = await api.admin.removeUser(id); setMessage(res.message); await load(); }
    catch (err: any) { setError(err?.message || "Không xóa được người dùng."); }
  }

  return (
    <section className="page stack">
      <div>
        <h1 className="page-title">Quản lý người dùng</h1>
        <p className="page-subtitle">Tìm kiếm, đổi quyền User/Admin và xóa tài khoản.</p>
      </div>
      {message && <div className="notice">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      <div className="card between">
        <input className="input" style={{ maxWidth: 360 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm username/email" />
        <button className="btn secondary" onClick={load}>Tìm kiếm</button>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Tài khoản</th><th>Email</th><th>Quyền</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead>
          <tbody>
            {users.map((u) => <tr key={u.id}>
              <td>{u.id}</td>
              <td><strong>{u.username}</strong></td>
              <td>{u.email}</td>
              <td><span className={`badge ${isAdminRole(u.role) ? "blue" : "gray"}`}>{u.role}</span></td>
              <td>{new Date(u.createdAt).toLocaleString("vi-VN")}</td>
              <td className="row">
                <button className="btn secondary" onClick={() => updateRole(u.id, isAdminRole(u.role) ? 0 : 1)}><UserCog size={15} /> {isAdminRole(u.role) ? "Set User" : "Set Admin"}</button>
                <button className="btn danger" onClick={() => remove(u.id)}><Trash2 size={15} /></button>
              </td>
            </tr>)}
            {!users.length && <tr><td colSpan={6}>Không có người dùng.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="notice warn row"><ShieldCheck size={16} /> Tài khoản quản trị hiện tại không thể tự xóa hoặc tự đổi quyền của chính mình.</div>
    </section>
  );
}

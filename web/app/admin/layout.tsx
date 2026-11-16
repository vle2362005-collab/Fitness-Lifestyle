"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, Utensils, Users } from "lucide-react";
import { RequireAdmin } from "@/app/components/AuthProvider";

const links = [
  { href: "/admin", label: "Tổng quan", icon: BarChart3 },
  { href: "/admin/exercises", label: "Bài tập", icon: Dumbbell },
  { href: "/admin/foods", label: "Món ăn", icon: Utensils },
  { href: "/admin/users", label: "Người dùng", icon: Users }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAdmin>
      <div className="sidebar-layout">
        <aside className="sidebar">
          <div className="row" style={{ marginBottom: 14 }}>
            <span className="logo-mark"><BarChart3 size={18} /></span>
            <div><strong>Trung tâm quản trị</strong><div className="muted small">Bài tập · Dinh dưỡng · Người dùng</div></div>
          </div>
          <nav className="sidebar-links">
            {links.map((link) => {
              const Icon = link.icon;
              const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
              return <Link key={link.href} href={link.href} className={`sidebar-link ${active ? "active" : ""}`}><Icon size={18} /> {link.label}</Link>;
            })}
          </nav>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </RequireAdmin>
  );
}

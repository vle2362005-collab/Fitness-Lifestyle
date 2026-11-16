"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Camera, Dumbbell, HeartPulse, LayoutDashboard, Users, Utensils } from "lucide-react";
import { RequireAuth } from "@/app/components/AuthProvider";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/exercises", label: "Bài tập", icon: Dumbbell },
  { href: "/trueformcoach", label: "AI Coach", icon: Camera },
  { href: "/nutrition", label: "Dinh dưỡng", icon: Utensils },
  { href: "/progress", label: "Tiến độ", icon: BarChart3 },
  { href: "/community", label: "Cộng đồng", icon: Users },
  { href: "/profile", label: "Hồ sơ sức khỏe", icon: HeartPulse }
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth>
      <div className="sidebar-layout">
        <aside className="sidebar">
          <div className="row" style={{ marginBottom: 14 }}>
            <span className="logo-mark"><Activity size={18} /></span>
            <div>
              <strong>Fitness Coach Hub</strong>
              <div className="muted small">AI Coach · Dinh dưỡng · Tiến độ</div>
            </div>
          </div>
          <nav className="sidebar-links">
            {links.map((link) => {
              const Icon = link.icon;
              return <Link key={link.href} href={link.href} className={`sidebar-link ${pathname.startsWith(link.href) ? "active" : ""}`}><Icon size={18} /> {link.label}</Link>;
            })}
          </nav>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </RequireAuth>
  );
}

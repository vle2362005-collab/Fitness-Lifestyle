"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";

const userLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/exercises", label: "Bài tập" },
  { href: "/trueformcoach", label: "AI Coach" },
  { href: "/nutrition", label: "Dinh dưỡng" },
  { href: "/progress", label: "Tiến độ" },
  { href: "/community", label: "Cộng đồng" }
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link href={user ? "/dashboard" : "/"} className="logo" aria-label="FitnessLifestyle home">
          <span className="logo-text">FitnessLifestyle</span>
        </Link>

        <nav className="nav-links">
          {user ? (
            <>
              {userLinks.map((link) => (
                <Link key={link.href} href={link.href} className={`nav-link ${pathname.startsWith(link.href) ? "active" : ""}`}>
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link href="/admin" className={`nav-link ${pathname.startsWith("/admin") ? "active" : ""}`}>
                  Admin
                </Link>
              )}
              <button className="btn ghost" onClick={logout}><LogOut size={16} /> Đăng xuất</button>
            </>
          ) : (
            <>
              <Link href="/login" className={`nav-link ${pathname === "/login" ? "active" : ""}`}>Đăng nhập</Link>
              <Link href="/register" className="btn">Tạo tài khoản</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

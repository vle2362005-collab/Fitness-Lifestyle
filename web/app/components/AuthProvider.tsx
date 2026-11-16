"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearSession, getStoredSession, isAdminRole, saveSession } from "@/services/api";
import type { UserSession } from "@/lib/types";

type AuthContextValue = {
  user: UserSession | null;
  loading: boolean;
  error: string;
  isAdmin: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<UserSession>;
  register: (payload: { username: string; email?: string; password: string; fullName?: string }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getStoredSession();
    setUser(stored);
    setLoading(false);
    const expired = () => setUser(null);
    window.addEventListener("fitness-session-expired", expired);
    return () => window.removeEventListener("fitness-session-expired", expired);
  }, []);

  const refreshMe = useCallback(async () => {
    const stored = getStoredSession();
    if (!stored?.token) {
      setUser(null);
      return;
    }
    try {
      const me = await api.auth.me();
      const nextSession: UserSession = {
        ...stored,
        userId: Number(me.id ?? stored.userId),
        username: me.username ?? stored.username,
        email: me.email ?? stored.email,
        role: me.role ?? stored.role
      };
      saveSession(nextSession);
      setUser(nextSession);
    } catch {
      clearSession();
      setUser(null);
    }
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    setError("");
    const session = await api.auth.login(usernameOrEmail, password);
    const normalized: UserSession = {
      token: session.token,
      userId: Number(session.userId),
      username: session.username,
      email: session.email,
      role: session.role
    };
    saveSession(normalized);
    setUser(normalized);
    return normalized;
  }, []);

  const register = useCallback(async (payload: { username: string; email?: string; password: string; fullName?: string }) => {
    setError("");
    await api.auth.register(payload);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    isAdmin: isAdminRole(user?.role),
    login,
    register,
    logout,
    refreshMe
  }), [user, loading, error, login, register, logout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function RequireAuth({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (adminOnly && !isAdmin) router.replace("/dashboard");
  }, [loading, user, adminOnly, isAdmin, router]);

  if (loading) return <div className="page"><div className="container"><div className="card">Đang kiểm tra đăng nhập...</div></div></div>;
  if (!user) return null;
  if (adminOnly && !isAdmin) return null;
  return <>{children}</>;
}


export function RequireAdmin({ children }: { children: React.ReactNode }) {
  return <RequireAuth adminOnly={true}>{children}</RequireAuth>;
}

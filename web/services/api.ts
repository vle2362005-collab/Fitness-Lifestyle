import type {
  AdminStats,
  AdminUser,
  Badge,
  DashboardSummary,
  Exercise,
  Food,
  MedicalProfile,
  NutritionLog,
  NutritionSummary,
  UserBadge,
  UserSession,
  WorkoutAnalysis,
  WorkoutSession
} from "@/lib/types";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5088/api").replace(/\/$/, "");
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/i, "");

export class ApiClientError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fitness_token");
}

export function getStoredSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("fitness_session");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function saveSession(session: UserSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem("fitness_session", JSON.stringify(session));
  localStorage.setItem("fitness_token", session.token);
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("fitness_session");
  localStorage.removeItem("fitness_token");
}

export function isAdminRole(role?: string | null): boolean {
  return String(role || "").toLowerCase() === "admin";
}

export function toAssetUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  if (url.startsWith("/")) return `${SERVER_BASE_URL}${url}`;
  return url;
}

function buildHeaders(body?: unknown): HeadersInit {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  return headers;
}

function normalizeError(payload: unknown, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload || fallback;
  if (typeof payload === "object") {
    const anyPayload = payload as Record<string, any>;
    if (typeof anyPayload.message === "string") return anyPayload.message;
    if (typeof anyPayload.error === "string") return anyPayload.error;
    if (typeof anyPayload.title === "string") return anyPayload.title;
    if (anyPayload.errors && typeof anyPayload.errors === "object") {
      const first = Object.values(anyPayload.errors).flat()[0];
      if (typeof first === "string") return first;
    }
  }
  return fallback;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = init.body;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...buildHeaders(body),
      ...(init.headers || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      clearSession();
      window.dispatchEvent(new Event("fitness-session-expired"));
    }
    throw new ApiClientError(normalizeError(payload, `Lỗi hệ thống ${response.status}`), response.status, payload);
  }

  return payload as T;
}

export function jsonBody(data: unknown): BodyInit {
  return JSON.stringify(data ?? {});
}

export const api = {
  auth: {
    login: (usernameOrEmail: string, password: string) =>
      apiFetch<UserSession>("/Auth/login", {
        method: "POST",
        body: jsonBody({ username: usernameOrEmail, email: usernameOrEmail, password })
      }),
    register: (payload: { username: string; email?: string; password: string; fullName?: string }) =>
      apiFetch<{ message: string; userId: number; username: string; email: string; role: string }>("/Auth/register", {
        method: "POST",
        body: jsonBody(payload)
      }),
    me: () => apiFetch<any>("/Auth/me")
  },

  dashboard: {
    get: () => apiFetch<DashboardSummary>("/Dashboard")
  },

  profile: {
    get: () => apiFetch<MedicalProfile>("/Profile"),
    upsert: (payload: { height: number; weight: number; age: number; gender: number; activityLevel: number; goal: number }) =>
      apiFetch<{ message: string; profile: MedicalProfile }>("/Profile", { method: "POST", body: jsonBody(payload) })
  },

  exercises: {
    list: (params?: { category?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.category) qs.set("category", params.category);
      if (params?.search) qs.set("search", params.search);
      return apiFetch<Exercise[]>(`/Exercise${qs.toString() ? `?${qs}` : ""}`);
    },
    categories: () => apiFetch<string[]>("/Exercise/categories"),
    get: (id: number) => apiFetch<Exercise>(`/Exercise/${id}`),
    create: (formData: FormData) => apiFetch<{ message: string; exercise: Exercise }>("/Exercise", { method: "POST", body: formData }),
    update: (id: number, formData: FormData) => apiFetch<{ message: string; exercise: Exercise }>(`/Exercise/${id}`, { method: "PUT", body: formData }),
    updateImage: (id: number, formData: FormData) => apiFetch<{ message: string; exercise: Exercise; imageUrl: string }>(`/Exercise/${id}/image`, { method: "PUT", body: formData }),
    deleteImage: (id: number) => apiFetch<{ message: string; exercise: Exercise }>(`/Exercise/${id}/image`, { method: "DELETE" }),
    remove: (id: number) => apiFetch<{ message: string }>(`/Exercise/${id}`, { method: "DELETE" })
  },

  workout: {
    list: () => apiFetch<WorkoutSession[]>("/Workout"),
    log: (payload: {
      exerciseId: number;
      durationMinutes: number;
      durationInSeconds?: number;
      reps?: number;
      sets?: number;
      caloriesBurned?: number;
      accuracyScore?: number;
      performedAt?: string;
    }) => apiFetch<{ message: string; workoutId: number; caloriesBurned: number }>("/Workout", { method: "POST", body: jsonBody(payload) }),
    remove: (id: number) => apiFetch<{ message: string }>(`/Workout/${id}`, { method: "DELETE" })
  },

  analysis: {
    list: () => apiFetch<WorkoutAnalysis[]>("/WorkoutAnalysis"),
    create: (payload: {
      exerciseId: number;
      workoutSessionId?: number | null;
      analysisType?: string;
      videoName?: string;
      videoUrl?: string;
      totalReps: number;
      totalSets: number;
      durationInSeconds: number;
      caloriesBurned: number;
      accuracyScore: number;
      feedbackSummary?: string;
      detectedErrorsJson?: string;
      rawResultJson?: string;
      status?: string;
      createWorkoutSession?: boolean;
    }) => apiFetch<{ message: string; analysisId: number; workoutSessionId?: number | null; videoUrl?: string | null }>("/WorkoutAnalysis", { method: "POST", body: jsonBody(payload) }),
    upload: (formData: FormData) => apiFetch<{ message: string; analysisId: number; workoutSessionId?: number | null; videoUrl?: string | null }>("/WorkoutAnalysis/upload", { method: "POST", body: formData }),
    remove: (id: number) => apiFetch<{ message: string }>(`/WorkoutAnalysis/${id}`, { method: "DELETE" })
  },

  foods: {
    list: (search?: string) => apiFetch<Food[]>(`/Food${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    create: (payload: Partial<Food>) => apiFetch<{ message: string; food: Food }>("/Food", { method: "POST", body: jsonBody(payload) }),
    update: (id: number, payload: Partial<Food>) => apiFetch<{ message: string; food: Food }>(`/Food/${id}`, { method: "PUT", body: jsonBody(payload) }),
    remove: (id: number) => apiFetch<{ message: string }>(`/Food/${id}`, { method: "DELETE" })
  },

  nutrition: {
    foods: (search?: string) => apiFetch<Food[]>(`/Nutrition/foods${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    logs: () => apiFetch<NutritionLog[]>("/Nutrition"),
    summary: (date?: string) => apiFetch<NutritionSummary>(`/Nutrition/summary${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    log: (payload: { foodId: number; quantity: number; mealType: number; date?: string }) =>
      apiFetch<{ message: string; logId: number }>("/Nutrition", { method: "POST", body: jsonBody(payload) }),
    remove: (id: number) => apiFetch<{ message: string }>(`/Nutrition/${id}`, { method: "DELETE" })
  },

  badges: {
    list: () => apiFetch<Badge[]>("/Badge"),
    mine: () => apiFetch<UserBadge[]>("/Badge/mine"),
    create: (payload: { name: string; description?: string; iconUrl?: string }) => apiFetch<{ message: string; badge: Badge }>("/Badge", { method: "POST", body: jsonBody(payload) }),
    award: (payload: { userId: number; badgeId: number }) => apiFetch<{ message: string; userBadgeId?: number }>("/Badge/award", { method: "POST", body: jsonBody(payload) })
  },

  admin: {
    stats: () => apiFetch<AdminStats>("/Admin/stats"),
    users: (search?: string) => apiFetch<AdminUser[]>(`/Admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    updateRole: (id: number, role: 0 | 1) => apiFetch<{ message: string; userId: number; role: string }>(`/Admin/users/${id}/role`, { method: "PUT", body: jsonBody({ role }) }),
    removeUser: (id: number) => apiFetch<{ message: string }>(`/Admin/users/${id}`, { method: "DELETE" })
  },

  chat: {
    ask: (message: string) => apiFetch<{ answer?: string; message?: string; response?: string; reply?: string }>("/Chat/ask", { method: "POST", body: jsonBody({ message, question: message }) })
  }
};

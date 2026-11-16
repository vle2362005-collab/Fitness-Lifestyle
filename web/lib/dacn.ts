import { apiFetch, jsonBody } from "@/services/api";

export type Joint = { x: number; y: number; score: number };
export type Frame = { sequence: number; timestampMs: number; width: number; height: number; points: Record<string, Joint> };
export type PoseStep = {
  sequence: number; timestampMs: number; phase: string; tracking: boolean;
  angleDegrees: number | null; completedReps: number; formOkReps: number;
  partialAttempts: number; feedbackCode: string | null;
};
export type Finished = { workoutId: number; analysisId: number; result: PoseStep; durationSeconds: number };
export type Fixture = { title: string; exercise: string; frames: Frame[] };
export type FeedPost = {
  id: number; content: string; author: string; isMine: boolean; createdAt: string;
  updatedAt: string | null; liked: boolean; likeCount: number; commentCount: number;
  exerciseName: string | null; reps: number | null; durationSeconds: number | null;
};
export type Comment = { id: number; content: string; author: string; isMine: boolean; isSuggestion: boolean };
export type PageResult<T> = { items: T[]; nextBefore: number | null };

function post<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, { method: "POST", body: jsonBody(body), signal: AbortSignal.timeout(12_000) });
}
export const coachApi = {
  start: (exerciseId: number) => post<{ sessionId: string }>("/pose-coach/sessions", { exerciseId }),
  send: (id: string, frame: Frame) => post<{ latest: PoseStep | null }>(`/pose-coach/sessions/${id}/frames`, { frames: [frame] }),
  sendBatch: (id: string, frames: Frame[]) => post<{ latest: PoseStep | null }>(`/pose-coach/sessions/${id}/frames`, { frames }),
  finish: (id: string) => post<Finished>(`/pose-coach/sessions/${id}/finish`),
  cancel: (id: string) => apiFetch<void>(`/pose-coach/sessions/${id}`, { method: "DELETE", signal: AbortSignal.timeout(5_000) }),
  replay: (fixture: Fixture) => post<{ summary: PoseStep; trackedFrames: number }>("/pose-coach/replay", { exercise: fixture.exercise, frames: fixture.frames }),
};
const feed = "/community/posts";
const cursor = (before?: number) => before ? `?before=${before}` : "";
export const communityApi = {
  list: (before?: number) => apiFetch<PageResult<FeedPost>>(`${feed}${cursor(before)}`),
  create: (content: string, analysisId: number | null) => post<{ id: number }>(feed, { content, analysisId }),
  edit: (id: number, content: string) => apiFetch<void>(`${feed}/${id}`, { method: "PUT", body: jsonBody({ content }) }),
  remove: (id: number) => apiFetch<void>(`${feed}/${id}`, { method: "DELETE" }),
  like: (id: number, liked: boolean) => apiFetch<void>(`${feed}/${id}/like`, { method: liked ? "DELETE" : "PUT" }),
  comments: (id: number, before?: number) => apiFetch<PageResult<Comment>>(`${feed}/${id}/comments${cursor(before)}`),
  comment: (id: number, content: string, isSuggestion: boolean) => post(`${feed}/${id}/comments`, { content, isSuggestion }),
  deleteComment: (id: number, commentId: number) => apiFetch<void>(`${feed}/${id}/comments/${commentId}`, { method: "DELETE" }),
};

export function coachKey(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized === "squat") return "squat";
  return ["pushup", "push-up", "push up"].includes(normalized) ? "pushup" : null;
}

export function poseLabel(phase?: string) {
  switch (phase) {
    case "waiting": return "Chờ tư thế bắt đầu";
    case "ready": return "Sẵn sàng";
    case "descending": return "Đang hạ";
    case "depth": return "Đã đạt ngưỡng biên độ";
    case "lost": return "Chưa thấy đủ khớp";
    default: return "Đang chờ dữ liệu";
  }
}
export function feedbackLabel(code?: string | null) {
  switch (code) {
    case "tracking_lost": return "Đưa toàn thân vào khung hình và kiểm tra ánh sáng.";
    case "review_alignment": return "Xem lại trục thân trong động tác.";
    case "incomplete_range": return "Động tác chưa đủ biên độ để cộng rep.";
    case "rep_complete": return "Đã ghi nhận một rep.";
    default: return null;
  }
}

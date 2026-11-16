"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PoseDetector } from "@tensorflow-models/pose-detection";
import { api } from "@/services/api";
import type { Exercise } from "@/lib/types";
import { coachApi, coachKey, feedbackLabel, poseLabel } from "@/lib/dacn";
import type { Finished, Fixture, Frame, Joint, PoseStep } from "@/lib/dacn";

type Run = {
  stopped: boolean; id: string | null; stream: MediaStream | null;
  detector: PoseDetector | null; timer: ReturnType<typeof setTimeout> | null;
  job: Promise<void> | null; sequence: number; started: number;
};
type Mode = "idle" | "starting" | "live" | "stopped" | "saving" | "clip";
const links = [["shoulder", "elbow"], ["elbow", "wrist"], ["shoulder", "hip"], ["hip", "knee"], ["knee", "ankle"]];

function stopCamera(run: Run) {
  run.stopped = true;
  if (run.timer !== null) clearTimeout(run.timer);
  run.stream?.getTracks().forEach(track => track.stop());
}
async function loadDetector(): Promise<PoseDetector> {
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");
  try {
    if (!await tf.setBackend("webgl")) await tf.setBackend("cpu");
  } catch { await tf.setBackend("cpu"); }
  await tf.ready();
  const pd = await import("@tensorflow-models/pose-detection");
  return pd.createDetector(pd.SupportedModels.MoveNet, {
    modelType: pd.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: false,
  });
}
function draw(canvas: HTMLCanvasElement | null, points: Record<string, Joint>, w: number, h: number) {
  if (!canvas) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#67e8f9"; ctx.fillStyle = "#fff"; ctx.lineWidth = Math.max(3, w / 200);
  for (const side of ["left", "right"]) {
    for (const [a, b] of links) {
      const p = points[`${side}_${a}`], q = points[`${side}_${b}`];
      if (!p || !q || Math.min(p.score, q.score) < .4) continue;
      ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke();
    }
  }
  for (const p of Object.values(points)) {
    if (p.score < .4) continue;
    ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(3, w / 140), 0, 2 * Math.PI); ctx.fill();
  }
}
function pointsOf(poses: Awaited<ReturnType<PoseDetector["estimatePoses"]>>, width: number, height: number) {
  const points: Record<string, Joint> = {};
  for (const p of poses[0]?.keypoints ?? []) {
    if (!p.name || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    points[p.name] = { x: clamp(p.x / width), y: clamp(p.y / height), score: clamp(p.score ?? 0) };
  }
  return points;
}

function mediaEvent(media: HTMLVideoElement, event: string, change: () => void) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => settle(new Error("Đọc video quá lâu.")), 8000);
    function settle(error?: Error) {
      window.clearTimeout(timer);
      media.removeEventListener(event, success);
      media.removeEventListener("error", failure);
      if (error) reject(error); else resolve();
    }
    const success = () => settle();
    const failure = () => settle(new Error("Không đọc được định dạng video."));
    media.addEventListener(event, success);
    media.addEventListener("error", failure);
    try { change(); } catch { failure(); }
  });
}
function disposeDetector(run: Run) {
  const detector = run.detector;
  run.detector = null;
  detector?.dispose();
}

const message = (e: unknown) => e instanceof Error ? e.message : "Đã xảy ra lỗi. Vui lòng thử lại.";

export default function CoachPage() {
  const video = useRef<HTMLVideoElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const runRef = useRef<Run | null>(null);
  const mounted = useRef(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseId, setExerciseId] = useState(0);
  const [mode, setMode] = useState<Mode>("idle");
  const [ratio, setRatio] = useState("16 / 9");
  const [latest, setLatest] = useState<PoseStep | null>(null);
  const [saved, setSaved] = useState<Finished | null>(null);
  const [error, setError] = useState("");
  const [clip, setClip] = useState<File | null>(null);
  const [clipProgress, setClipProgress] = useState(0);
  const [replayBusy, setReplayBusy] = useState(false);
  const [replay, setReplay] = useState<{ summary: PoseStep; trackedFrames: number } | null>(null);

  useEffect(() => {
    mounted.current = true;
    let live = true;
    api.exercises.list().then(rows => {
      if (!live) return;
      const supported = rows.filter(x => coachKey(x.name));
      const id = Number(new URLSearchParams(window.location.search).get("exerciseId"));
      setExercises(supported);
      setExerciseId(supported.find(x => x.id === id)?.id ?? supported[0]?.id ?? 0);
    }).catch(e => { if (live) setError(message(e)); });
    return () => {
      live = false; mounted.current = false;
      const run = runRef.current;
      runRef.current = null;
      if (run) {
        stopCamera(run);
        void (run.job ?? Promise.resolve()).finally(() => disposeDetector(run));
        if (run.id) void coachApi.cancel(run.id).catch(() => {});
      }
    };
  }, []);

  function tick(run: Run) {
    if (run.stopped || runRef.current !== run) return;
    run.job = (async () => {
      const streamVideo = video.current;
      if (!streamVideo || !streamVideo.videoWidth || streamVideo.readyState < 2 || !run.detector || !run.id) return;
      const timestampMs = Math.round(performance.now() - run.started);
      if (timestampMs >= 595_000) {
        stopCamera(run);
        setMode("stopped");
        return;
      }
      const width = streamVideo.videoWidth, height = streamVideo.videoHeight;
      const poses = await run.detector.estimatePoses(streamVideo, { flipHorizontal: false });
      if (run.stopped) return;
      const points = pointsOf(poses, width, height);
      draw(canvas.current, points, width, height);
      const frame: Frame = { sequence: run.sequence++, timestampMs, width, height, points };
      const response = await coachApi.send(run.id, frame);
      if (runRef.current === run && mounted.current) { setLatest(response.latest); setError(""); }
    })().catch(e => {
      if (runRef.current === run && !run.stopped) setError(message(e));
    }).finally(() => {
      run.job = null;
      if (!run.stopped) run.timer = setTimeout(() => tick(run), 75);
    });
  }

  async function start() {
    if (runRef.current || !exerciseId) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera trình duyệt cần localhost hoặc HTTPS."); return;
    }
    const run: Run = { stopped: false, id: null, stream: null, detector: null, timer: null, job: null, sequence: 0, started: 0 };
    runRef.current = run; setMode("starting"); setError(""); setLatest(null); setSaved(null);
    try {
      run.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: { ideal: "environment" } }, audio: false,
      });
      if (run.stopped || !video.current) { stopCamera(run); return; }
      video.current.srcObject = run.stream;
      await video.current.play();
      if (run.stopped) return;
      setRatio(`${video.current.videoWidth || 640} / ${video.current.videoHeight || 480}`);
      run.detector = await loadDetector();
      if (run.stopped) { disposeDetector(run); return; }
      run.id = (await coachApi.start(exerciseId)).sessionId;
      if (run.stopped) { await coachApi.cancel(run.id).catch(() => {}); return; }
      run.started = performance.now();
      setMode("live"); tick(run);
    } catch (e) {
      stopCamera(run);
      disposeDetector(run);
      if (run.id) void coachApi.cancel(run.id).catch(() => {});
      if (runRef.current === run) {
        runRef.current = null; setError(message(e)); setMode("idle");
      }
    }
  }

  async function end(save: boolean) {
    const run = runRef.current;
    if (!run || mode === "saving") return;
    setMode("saving"); setError("");
    stopCamera(run);
    if (video.current) video.current.srcObject = null;
    await run.job;
    disposeDetector(run);
    try {
      if (run.id) {
        if (save) {
          const result = await coachApi.finish(run.id);
          if (mounted.current) { setSaved(result); setLatest(result.result); }
        } else {
          await coachApi.cancel(run.id);
        }
      }
      if (runRef.current === run) { runRef.current = null; setMode("idle"); }
    } catch (e) {
      if (runRef.current === run) { setError(message(e)); setMode("stopped"); }
    }
  }

  async function analyzeClip() {
    if (!clip || runRef.current || !exerciseId || replayBusy) return;
    if (clip.size > 150 * 1024 * 1024) {
      setError("Chọn clip tối đa 150 MB và 2 phút."); return;
    }
    const run: Run = { stopped: false, id: null, stream: null, detector: null, timer: null, job: null, sequence: 0, started: 0 };
    runRef.current = run; setMode("clip"); setClipProgress(0); setError(""); setSaved(null); setLatest(null);
    const source = document.createElement("video");
    source.preload = "auto"; source.muted = true; source.playsInline = true;
    const url = URL.createObjectURL(clip);
    // This job owns the detector during clip processing so unmount never disposes it mid-inference.
    run.job = (async () => {
      let didSave = false;
      try {
        await mediaEvent(source, "loadeddata", () => { source.src = url; });
        if (run.stopped) return;
        if (!Number.isFinite(source.duration) || source.duration < 1 || source.duration > 120 || !source.videoWidth) {
          throw new Error("Chọn clip có thời lượng từ 1 giây đến 2 phút.");
        }
        run.detector = await loadDetector();
        if (run.stopped) return;
        run.id = (await coachApi.start(exerciseId)).sessionId;
        if (run.stopped) return;
        const width = source.videoWidth, height = source.videoHeight;
        const frames: Frame[] = [];
        const sampleEveryMs = 100;
        const end = Math.floor(source.duration * 1000);
        for (let t = 0; t < end && !run.stopped; t += sampleEveryMs) {
          if (Math.abs(source.currentTime - t / 1000) > .001)
            await mediaEvent(source, "seeked", () => { source.currentTime = t / 1000; });
          if (run.stopped) break;
          const poses = await run.detector.estimatePoses(source, { flipHorizontal: false });
          if (run.stopped) break;
          frames.push({ sequence: run.sequence++, timestampMs: t, width, height, points: pointsOf(poses, width, height) });
          if (frames.length === 12 || t + sampleEveryMs >= end) {
            const response = await coachApi.sendBatch(run.id, frames);
            frames.length = 0;
            if (mounted.current && !run.stopped) {
              setLatest(response.latest); setClipProgress(Math.min(100, Math.round((t + sampleEveryMs) / end * 100)));
            }
          }
        }
        if (run.stopped) return;
        const result = await coachApi.finish(run.id);
        didSave = true;
        if (mounted.current) { setSaved(result); setLatest(result.result); }
      } catch (e) {
        if (mounted.current && !run.stopped) setError(message(e));
      } finally {
        if (run.id && !didSave) await coachApi.cancel(run.id).catch(() => {});
        disposeDetector(run);
        source.removeAttribute("src"); source.load(); URL.revokeObjectURL(url);
        if (runRef.current === run) { runRef.current = null; setMode("idle"); }
      }
    })();
    await run.job;
  }

  async function tryReplay() {
    setReplayBusy(true); setReplay(null); setError("");
    try {
      const response = await fetch("/pose_fixtures.json");
      if (!response.ok) throw new Error("Không tìm thấy dữ liệu mẫu.");
      const fixtures = await response.json() as Fixture[];
      const item = fixtures.find(x => x.exercise === "squat");
      if (!item) throw new Error("Không có ca Squat.");
      setReplay(await coachApi.replay(item));
    } catch (e) { setError(message(e)); }
    finally { setReplayBusy(false); }
  }

  const hint = feedbackLabel(latest?.feedbackCode);
  return <div className="page">
    <p className="muted small">FITNESS & LIFESTYLE / LUYỆN TẬP</p>
    <h1 className="page-title">AI Coach</h1>
    <p className="page-subtitle">Đặt camera ngang thân người. Bắt đầu ở tư thế duỗi, tập chậm và giữ đủ cơ thể trong khung.</p>
    <div className="coach-grid">
      <section className="card">
        <label htmlFor="coach-exercise" className="small muted">Bài tập</label>
        <select id="coach-exercise" className="input" value={exerciseId} disabled={mode !== "idle"} onChange={e => setExerciseId(Number(e.target.value))}>
          {!exercises.length && <option value={0}>Chưa tải được bài hỗ trợ AI</option>}
          {exercises.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <div className="coach-camera" style={{ aspectRatio: ratio }}>
          <video ref={video} muted playsInline aria-label="Khung hình camera tập luyện" />
          <canvas ref={canvas} aria-hidden="true" />
          {mode === "idle" && <div className="coach-camera-empty">Camera đang tắt</div>}
          {mode === "starting" && <div className="coach-camera-empty">Đang mở camera và tải mô hình…</div>}
        </div>
        <div className="row coach-actions">
          {mode === "idle" && <button className="btn" disabled={!exerciseId || replayBusy} onClick={start}>Bắt đầu camera</button>}
          {(mode === "live" || mode === "stopped") && <>
            <button className="btn" onClick={() => end(true)}>Kết thúc và lưu</button>
            <button className="btn ghost" onClick={() => end(false)}>Hủy buổi tập</button>
          </>}
          {mode === "saving" && <span role="status">Đang xử lý…</span>}
          <button className="btn secondary" disabled={mode !== "idle" || replayBusy} onClick={tryReplay}>
            {replayBusy ? "Đang thử…" : "Thử dữ liệu mẫu"}
          </button>
        </div>
        <details style={{marginTop: 14}}>
          <summary>Phân tích video đã quay</summary>
          <p className="muted small">Video được đọc tại trình duyệt; chỉ gửi điểm khớp. Tối đa 2 phút.</p>
          <input type="file" accept="video/*" className="input" disabled={mode !== "idle"} onChange={e => setClip(e.target.files?.[0] ?? null)} />
          <div className="row coach-actions">
            <button className="btn secondary" disabled={!clip || !exerciseId || mode !== "idle" || replayBusy} onClick={analyzeClip}>Phân tích và lưu</button>
            {mode === "clip" && <><span role="status">{clipProgress}%</span>
              <button className="btn ghost" onClick={() => { const run = runRef.current; if (run) stopCamera(run); }}>Dừng</button></>}
          </div>
        </details>
        {error && <p role="alert" className="coach-error">{error}</p>}
      </section>
      <section className="card">
        <p className="small muted">PHẢN HỒI TƯ THẾ</p>
        <h2>{poseLabel(latest?.phase)}</h2>
        <div className="coach-metrics">
          <div><b>{latest?.completedReps ?? 0}</b><span>Rep hoàn tất</span></div>
          <div><b>{latest?.formOkReps ?? 0}</b><span>Rep đạt luật</span></div>
          <div><b>{latest?.angleDegrees == null ? "—" : `${latest.angleDegrees}°`}</b><span>Góc khớp</span></div>
        </div>
        {hint && <p role="status">{hint}</p>}
        {saved && <div className="coach-result">
          <strong>Đã lưu buổi tập.</strong>
          <div className="row coach-actions">
            <Link className="btn secondary" href="/progress">Xem tiến độ</Link>
            <Link className="btn ghost" href={`/community?analysisId=${saved.analysisId}`}>Chia sẻ kết quả</Link>
          </div>
        </div>}
        {replay && <div className="coach-result">
          <strong>Ca mẫu Squat: {replay.summary.completedReps} rep</strong>
          <p className="small muted">{replay.trackedFrames} mẫu được theo dõi. Ca thử không ghi vào lịch sử.</p>
        </div>}
        <p className="small muted">Điểm đạt luật dựa trên hình chiếu 2D và ngưỡng thử nghiệm.</p>
      </section>
    </div>
  </div>;
}

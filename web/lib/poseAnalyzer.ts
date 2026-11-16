import type { Exercise } from "./types";

export type Landmark = { name?: string; x: number; y: number; z?: number; visibility?: number; score?: number };

export type AiRule = { operator?: ">" | "<" | ">=" | "<="; value?: number; feedback?: string };

export type ExerciseMode =
  | "pushup"
  | "squat"
  | "plank"
  | "jumping_jack"
  | "lunge"
  | "bicep_curl"
  | "shoulder_press"
  | "lateral_raise"
  | "crunch"
  | "mountain_climber"
  | "high_knees"
  | "deadlift"
  | "glute_bridge"
  | "angle"
  | "vertical"
  | "motion";

export type ExerciseAiConfig = {
  mode?: ExerciseMode | string;
  metricName?: string;
  points?: string[];
  point?: string;
  minScore?: number;
  minRepIntervalMs?: number;
  targetRepsPerSet?: number;
  downRule?: AiRule;
  upRule?: AiRule;
  threshold?: number;
  strict?: boolean;
  requiredView?: "side" | "front" | "any" | string;
  missingFeedback?: string;
  warningFeedback?: string;
  downFeedback?: string;
  upFeedback?: string;
  instruction?: string;
  thresholds?: Record<string, number>;
};

const mediapipeIndex: Record<string, number> = {
  nose: 0,
  left_eye_inner: 1,
  left_eye: 2,
  left_eye_outer: 3,
  right_eye_inner: 4,
  right_eye: 5,
  right_eye_outer: 6,
  left_ear: 7,
  right_ear: 8,
  mouth_left: 9,
  mouth_right: 10,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
  left_heel: 29,
  right_heel: 30,
  left_foot_index: 31,
  right_foot_index: 32
};

const movenetKeypointNames = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle"
];

export const poseConnections: Array<[string, string]> = [
  ["left_ear", "left_eye"], ["right_ear", "right_eye"], ["left_eye", "nose"], ["right_eye", "nose"],
  ["left_shoulder", "right_shoulder"], ["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"], ["right_shoulder", "right_hip"], ["left_hip", "right_hip"],
  ["left_hip", "left_knee"], ["left_knee", "left_ankle"], ["right_hip", "right_knee"], ["right_knee", "right_ankle"]
];

export type AnalysisState = {
  reps: number;
  sets: number;
  phase: "up" | "down" | "hold" | "invalid" | "open" | "closed" | "left" | "right" | "ready" | "drive";
  metric: number;
  accuracy: number;
  feedback: string;
  lastChangedAt: number;
  validPose?: boolean;
  formScore?: number;
  errors?: string[];
  side?: "left" | "right" | "both";
  mode?: string;
  holdSeconds?: number;
  currentSetReps?: number;
  targetRepsPerSet?: number;
  lastRepAt?: number;
  lastFrameAt?: number;
  rawMetrics?: Record<string, number>;
};

type Side = "left" | "right";

type PoseContext = {
  now: number;
  minScore: number;
  targetRepsPerSet: number;
  minRepIntervalMs: number;
};

function normalizeText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function inferMode(exercise?: Exercise | null, config?: ExerciseAiConfig): ExerciseMode {
  const configured = normalizeText(config?.mode);
  const supported: ExerciseMode[] = [
    "pushup", "squat", "plank", "jumping_jack", "lunge", "bicep_curl", "shoulder_press", "lateral_raise",
    "crunch", "mountain_climber", "high_knees", "deadlift", "glute_bridge", "angle", "vertical", "motion"
  ];
  if (supported.includes(configured as ExerciseMode)) return configured as ExerciseMode;

  const name = normalizeText(`${exercise?.name || ""} ${exercise?.category || ""} ${exercise?.description || ""}`);
  if (includesAny(name, ["push", "push-up", "push up", "chong day", "hit dat", "hít đất", "chống đẩy"])) return "pushup";
  if (includesAny(name, ["plank", "tam van", "tấm ván"])) return "plank";
  if (includesAny(name, ["squat", "ngoi xom", "ngồi xổm", "leg press"])) return "squat";
  if (includesAny(name, ["jumping jack", "jump jack", "nhay dang tay", "nhảy dạng tay"])) return "jumping_jack";
  if (includesAny(name, ["mountain", "leo nui", "leo núi"])) return "mountain_climber";
  if (includesAny(name, ["high knee", "nang cao dui", "nâng cao đùi"])) return "high_knees";
  if (includesAny(name, ["lunge", "chung chan", "chùng chân", "split squat"])) return "lunge";
  if (includesAny(name, ["bicep", "curl", "cuon tay", "cuốn tay", "tay truoc", "tay trước"])) return "bicep_curl";
  if (includesAny(name, ["shoulder press", "overhead press", "day vai", "đẩy vai", "dumbbell press"])) return "shoulder_press";
  if (includesAny(name, ["lateral raise", "dang tay", "dang vai", "nang vai", "nâng vai"])) return "lateral_raise";
  if (includesAny(name, ["sit up", "sit-up", "crunch", "gap bung", "gập bụng", "abs"])) return "crunch";
  if (includesAny(name, ["deadlift", "hip hinge", "romanian", "rdl", "keo ta", "kéo tạ"])) return "deadlift";
  if (includesAny(name, ["glute bridge", "hip thrust", "cau mong", "cầu mông"])) return "glute_bridge";
  return "angle";
}

export function defaultAiConfig(exercise?: Exercise | null): ExerciseAiConfig {
  const mode = inferMode(exercise);
  const common = { minScore: 0.35, targetRepsPerSet: 12, minRepIntervalMs: 650, strict: true };
  switch (mode) {
    case "pushup":
      return {
        ...common,
        mode,
        metricName: "Góc khuỷu tay + thân người",
        minRepIntervalMs: 900,
        instruction: "Đặt camera ngang thân người, thấy vai - hông - gối/cổ chân - khuỷu - cổ tay. Hệ thống chỉ đếm khi thân người gần song song mặt sàn và core thẳng.",
        warningFeedback: "Push-up cần thân người nằm ngang, core thẳng; đứng gập khuỷu tay sẽ không được tính."
      };
    case "plank":
      return {
        ...common,
        mode,
        metricName: "Độ thẳng vai-hông-cổ chân",
        instruction: "Đặt camera ngang thân người. Giữ vai - hông - cổ chân gần một đường thẳng, không võng lưng hoặc nâng mông quá cao."
      };
    case "squat":
      return {
        ...common,
        mode,
        metricName: "Góc đầu gối + độ sâu hông",
        instruction: "Đặt camera hơi chếch bên hoặc chính diện, thấy vai - hông - gối - cổ chân. Hệ thống chỉ đếm khi đầu gối/hông xuống đủ sâu rồi đứng lên đủ thẳng."
      };
    case "lunge":
      return {
        ...common,
        mode,
        metricName: "Góc gối trước + thân trên",
        instruction: "Camera cần thấy cả hai chân. Giữ thân trên thẳng, bước đủ xa, xuống đến khi gối trước khoảng 90 độ rồi đứng lên."
      };
    case "jumping_jack":
      return {
        ...common,
        mode,
        metricName: "Mở/khép tay chân",
        minRepIntervalMs: 450,
        instruction: "Camera chính diện, thấy toàn thân. Một rep chỉ tính khi tay/chân mở rộng rồi khép lại hoàn chỉnh."
      };
    case "bicep_curl":
      return {
        ...common,
        mode,
        metricName: "Góc khuỷu tay + ổn định cánh tay trên",
        instruction: "Đứng thẳng, camera thấy vai - khuỷu - cổ tay - hông. Giữ khuỷu gần thân, chỉ gập cẳng tay; không vung vai."
      };
    case "shoulder_press":
      return {
        ...common,
        mode,
        metricName: "Đẩy tay qua đầu",
        instruction: "Đứng/ngồi thẳng, camera thấy vai - khuỷu - cổ tay. Đếm khi đẩy từ vị trí khuỷu gập lên qua đầu và duỗi gần hết tay."
      };
    case "lateral_raise":
      return {
        ...common,
        mode,
        metricName: "Độ nâng tay ngang vai",
        instruction: "Đứng thẳng, nâng tay sang ngang đến gần ngang vai rồi hạ xuống có kiểm soát."
      };
    case "crunch":
      return {
        ...common,
        mode,
        metricName: "Gập thân với gối",
        instruction: "Camera ngang thân người, thấy vai - hông - gối. Chỉ đếm khi thân trên gập lên rồi hạ xuống rõ ràng."
      };
    case "mountain_climber":
      return {
        ...common,
        mode,
        metricName: "Plank + kéo gối",
        minRepIntervalMs: 300,
        instruction: "Vào tư thế plank, camera thấy vai - hông - gối - cổ chân. Đếm từng lần kéo gối về phía ngực khi thân vẫn thẳng."
      };
    case "high_knees":
      return {
        ...common,
        mode,
        metricName: "Nâng gối cao",
        minRepIntervalMs: 280,
        instruction: "Camera chính diện, giữ thân thẳng. Đếm mỗi lần gối trái/phải nâng lên gần ngang hông."
      };
    case "deadlift":
      return {
        ...common,
        mode,
        metricName: "Hip hinge + lưng thẳng",
        instruction: "Camera ngang thân người. Hinge bằng hông, lưng giữ thẳng, đầu gối không gập quá sâu như squat."
      };
    case "glute_bridge":
      return {
        ...common,
        mode,
        metricName: "Nâng hông",
        instruction: "Camera ngang thân người, thấy vai - hông - gối. Đếm khi nâng hông lên tạo đường thẳng vai-hông-gối rồi hạ xuống."
      };
    default:
      return {
        ...common,
        mode: "angle",
        metricName: "Góc 3 điểm chính",
        points: ["left_hip", "left_knee", "left_ankle"],
        downRule: { operator: "<", value: 105, feedback: "Xuống đủ sâu, chuẩn bị quay lại." },
        upRule: { operator: ">", value: 158, feedback: "Đã lên đủ cao, lặp lại nhịp tiếp theo." },
        instruction: "Bài chưa có template riêng, hệ thống dùng cấu hình 3 điểm trong AiConfig. Hãy đảm bảo camera thấy đủ 3 điểm chính."
      };
  }
}

export function parseAiConfig(exercise?: Exercise | null): ExerciseAiConfig {
  const defaults = defaultAiConfig(exercise);
  if (!exercise?.aiConfig) return defaults;
  try {
    const parsed = JSON.parse(exercise.aiConfig);
    const parsedMode = normalizeText(parsed.mode || parsed.type || "");
    const looksLikeLegacyGenericAngle = parsedMode === "angle" && defaults.mode !== "angle" && (!Array.isArray(parsed.points) || parsed.points.join("|") === "left_hip|left_knee|left_ankle");
    const mode = looksLikeLegacyGenericAngle ? defaults.mode : (parsed.mode || parsed.type || defaults.mode);
    return { ...defaults, ...parsed, mode, thresholds: { ...(defaults.thresholds || {}), ...(parsed.thresholds || {}) } };
  } catch {
    return defaults;
  }
}

export function normalizeMoveNetKeypoints(video: HTMLVideoElement, keypoints: any[] = []): Landmark[] {
  const width = video.videoWidth || video.clientWidth || 1;
  const height = video.videoHeight || video.clientHeight || 1;
  return keypoints.map((point, index) => {
    const name = point?.name || movenetKeypointNames[index] || `point_${index}`;
    const score = typeof point?.score === "number" ? point.score : 0;
    return {
      name,
      x: Math.max(0, Math.min(1, (Number(point?.x) || 0) / width)),
      y: Math.max(0, Math.min(1, (Number(point?.y) || 0) / height)),
      z: 0,
      visibility: score,
      score
    };
  });
}

function scoreOf(point?: Landmark | null) {
  return point ? (point.visibility ?? point.score ?? 1) : 0;
}

export function getLandmark(landmarks: Landmark[], name?: string, minScore = 0.35): Landmark | null {
  if (!name) return null;
  const named = landmarks.find((point) => point?.name === name);
  const point = named || landmarks[mediapipeIndex[name]];
  if (!point) return null;
  const score = scoreOf(point);
  if (score < minScore) return null;
  return point;
}

function gp(landmarks: Landmark[], name: string, minScore = 0.35) {
  return getLandmark(landmarks, name, minScore);
}

function midpoint(a: Landmark | null, b: Landmark | null): Landmark | null {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, visibility: Math.min(scoreOf(a), scoreOf(b)) };
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function calculateAngle(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magA = Math.hypot(ab.x, ab.y);
  const magC = Math.hypot(cb.x, cb.y);
  if (magA === 0 || magC === 0) return 0;
  const cosine = Math.min(1, Math.max(-1, dot / (magA * magC)));
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

function segmentAngleFromHorizontal(a: Landmark, b: Landmark) {
  const angle = Math.abs(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);
  return angle > 90 ? 180 - angle : angle;
}

function angleFromVertical(a: Landmark, b: Landmark) {
  return Math.abs(90 - segmentAngleFromHorizontal(a, b));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreClose(value: number, target: number, tolerance: number) {
  return clamp(100 - (Math.abs(value - target) / tolerance) * 100);
}

function scoreMin(value: number, goodAt: number, badAt: number) {
  if (goodAt === badAt) return value >= goodAt ? 100 : 0;
  return clamp(((value - badAt) / (goodAt - badAt)) * 100);
}

function scoreMax(value: number, goodAt: number, badAt: number) {
  if (goodAt === badAt) return value <= goodAt ? 100 : 0;
  return clamp(((badAt - value) / (badAt - goodAt)) * 100);
}

function weighted(items: Array<[number, number]>) {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  return Math.round(items.reduce((sum, [value, weight]) => sum + clamp(value) * weight, 0) / total);
}

function sideConfidence(landmarks: Landmark[], side: Side, joints: string[], minScore: number) {
  const points = joints.map((joint) => gp(landmarks, `${side}_${joint}`, minScore * 0.75)).filter(Boolean) as Landmark[];
  if (!points.length) return 0;
  return points.reduce((sum, point) => sum + scoreOf(point), 0) / joints.length;
}

function chooseSide(landmarks: Landmark[], joints: string[], minScore: number): Side {
  const left = sideConfidence(landmarks, "left", joints, minScore);
  const right = sideConfidence(landmarks, "right", joints, minScore);
  return left >= right ? "left" : "right";
}

function sidePoints(landmarks: Landmark[], side: Side, minScore: number) {
  return {
    shoulder: gp(landmarks, `${side}_shoulder`, minScore),
    elbow: gp(landmarks, `${side}_elbow`, minScore),
    wrist: gp(landmarks, `${side}_wrist`, minScore),
    hip: gp(landmarks, `${side}_hip`, minScore),
    knee: gp(landmarks, `${side}_knee`, minScore),
    ankle: gp(landmarks, `${side}_ankle`, minScore)
  };
}

function bothSidePoints(landmarks: Landmark[], minScore: number) {
  return {
    leftShoulder: gp(landmarks, "left_shoulder", minScore),
    rightShoulder: gp(landmarks, "right_shoulder", minScore),
    leftElbow: gp(landmarks, "left_elbow", minScore),
    rightElbow: gp(landmarks, "right_elbow", minScore),
    leftWrist: gp(landmarks, "left_wrist", minScore),
    rightWrist: gp(landmarks, "right_wrist", minScore),
    leftHip: gp(landmarks, "left_hip", minScore),
    rightHip: gp(landmarks, "right_hip", minScore),
    leftKnee: gp(landmarks, "left_knee", minScore),
    rightKnee: gp(landmarks, "right_knee", minScore),
    leftAnkle: gp(landmarks, "left_ankle", minScore),
    rightAnkle: gp(landmarks, "right_ankle", minScore)
  };
}

function bodyCenters(landmarks: Landmark[], minScore: number) {
  const leftShoulder = gp(landmarks, "left_shoulder", minScore);
  const rightShoulder = gp(landmarks, "right_shoulder", minScore);
  const leftHip = gp(landmarks, "left_hip", minScore);
  const rightHip = gp(landmarks, "right_hip", minScore);
  const leftKnee = gp(landmarks, "left_knee", minScore);
  const rightKnee = gp(landmarks, "right_knee", minScore);
  const leftAnkle = gp(landmarks, "left_ankle", minScore);
  const rightAnkle = gp(landmarks, "right_ankle", minScore);
  return {
    shoulder: midpoint(leftShoulder, rightShoulder),
    hip: midpoint(leftHip, rightHip),
    knee: midpoint(leftKnee, rightKnee),
    ankle: midpoint(leftAnkle, rightAnkle),
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle
  };
}

function postureVertical(shoulder: Landmark, hip: Landmark) {
  return angleFromVertical(shoulder, hip);
}

function postureHorizontal(shoulder: Landmark, hip: Landmark) {
  return segmentAngleFromHorizontal(shoulder, hip);
}

function bodyStraightness(shoulder: Landmark, hip: Landmark, end: Landmark) {
  const angle = calculateAngle(shoulder, hip, end);
  return { angle, deviation: Math.abs(180 - angle), score: scoreClose(angle, 180, 32) };
}

function makeFeedback(base: string, errors: string[] = []) {
  return errors.length ? `${base} ${errors.slice(0, 2).join(" ")}` : base;
}

export function completedSetCount(reps: number, targetRepsPerSet = 12) {
  const target = Math.max(1, Math.round(targetRepsPerSet || 12));
  return Math.floor(Math.max(0, Math.round(reps || 0)) / target);
}

export function repsInCurrentSet(reps: number, targetRepsPerSet = 12) {
  const target = Math.max(1, Math.round(targetRepsPerSet || 12));
  return Math.max(0, Math.round(reps || 0)) % target;
}

function nextBase(
  prev: AnalysisState,
  ctx: PoseContext,
  mode: string,
  phase: AnalysisState["phase"],
  metric: number,
  accuracy: number,
  feedback: string,
  validPose: boolean,
  errors: string[] = [],
  rawMetrics: Record<string, number> = {},
  countRep = false,
  side?: AnalysisState["side"],
  holdSeconds?: number
): AnalysisState {
  const canCount = countRep && ctx.now - (prev.lastRepAt || 0) >= ctx.minRepIntervalMs;
  const reps = canCount ? prev.reps + 1 : prev.reps;
  return {
    ...prev,
    reps,
    // Fitness rule: sets start at 0 and only increase after a full target block.
    // Example: target 12 reps/set -> 0..11 reps = 0 set, 12..23 = 1 set, 24..35 = 2 sets.
    sets: completedSetCount(reps, ctx.targetRepsPerSet),
    currentSetReps: repsInCurrentSet(reps, ctx.targetRepsPerSet),
    targetRepsPerSet: ctx.targetRepsPerSet,
    phase,
    metric: Math.round(metric),
    accuracy: Math.round(clamp(accuracy)),
    feedback,
    lastChangedAt: phase !== prev.phase ? ctx.now : prev.lastChangedAt,
    validPose,
    formScore: Math.round(clamp(accuracy)),
    errors,
    side,
    mode,
    holdSeconds,
    lastRepAt: canCount ? ctx.now : prev.lastRepAt,
    lastFrameAt: ctx.now,
    rawMetrics
  };
}

function invalid(prev: AnalysisState, ctx: PoseContext, mode: string, feedback: string, errors: string[] = [], metric = prev.metric): AnalysisState {
  return nextBase(prev, ctx, mode, "invalid", metric, 0, makeFeedback(feedback, errors), false, errors, {}, false, prev.side, prev.holdSeconds);
}

function matchRule(value: number, rule?: AiRule): boolean {
  if (!rule || typeof rule.value !== "number") return false;
  switch (rule.operator || ">") {
    case "<": return value < rule.value;
    case "<=": return value <= rule.value;
    case ">=": return value >= rule.value;
    case ">":
    default: return value > rule.value;
  }
}

function analyzePushup(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  const end = p.ankle || p.knee;
  const missing = [];
  if (!p.shoulder) missing.push("vai");
  if (!p.elbow) missing.push("khuỷu tay");
  if (!p.wrist) missing.push("cổ tay");
  if (!p.hip) missing.push("hông");
  if (!end) missing.push("gối/cổ chân");
  if (missing.length) return invalid(prev, ctx, "pushup", "Camera chưa thấy đủ điểm cho push-up.", [`Thiếu: ${missing.join(", ")}.`]);

  const shoulder = p.shoulder!;
  const elbow = p.elbow!;
  const wrist = p.wrist!;
  const hip = p.hip!;
  const bodyEnd = end!;
  const elbowAngle = calculateAngle(shoulder, elbow, wrist);
  const straight = bodyStraightness(shoulder, hip, bodyEnd);
  const torsoHorizontal = postureHorizontal(shoulder, hip);
  const bodyLength = distance(shoulder, bodyEnd);
  const errors: string[] = [];

  if (bodyLength < 0.2) errors.push("Đứng xa camera hơn để thấy đủ thân người.");
  if (torsoHorizontal > 48) errors.push("Push-up phải ở tư thế thân người gần ngang sàn, không phải đứng thẳng.");
  if (straight.angle < 152) errors.push("Siết core, giữ vai-hông-cổ chân gần một đường thẳng.");
  if (Math.abs(shoulder.y - hip.y) > 0.22) errors.push("Vai và hông đang lệch quá nhiều, chỉnh lại tư thế plank.");

  const formScore = weighted([
    [scoreMax(torsoHorizontal, 20, 55), 0.32],
    [straight.score, 0.34],
    [scoreMin(bodyLength, 0.34, 0.18), 0.14],
    [elbowAngle < 120 ? scoreMax(elbowAngle, 85, 130) : scoreMin(elbowAngle, 150, 120), 0.2]
  ]);
  const valid = !errors.length && formScore >= 62;
  if (!valid) return invalid(prev, ctx, "pushup", "Chưa đạt điều kiện đếm push-up.", errors, elbowAngle);

  const downAngle = config.thresholds?.downAngle ?? 105;
  const upAngle = config.thresholds?.upAngle ?? 154;
  let phase = prev.phase;
  let count = false;
  let feedback = "Giữ thân người thẳng và tiếp tục.";
  if (elbowAngle <= downAngle) {
    phase = "down";
    feedback = "Độ sâu tốt. Giữ core rồi đẩy lên.";
  } else if (elbowAngle >= upAngle) {
    count = prev.phase === "down" && prev.validPose !== false;
    phase = "up";
    feedback = count ? "Hoàn thành 1 push-up chuẩn." : "Tay đã duỗi, hạ xuống có kiểm soát.";
  } else {
    feedback = "Đang ở giữa biên độ, tiếp tục chuyển động mượt.";
  }

  return nextBase(prev, ctx, "pushup", phase, elbowAngle, formScore, feedback, true, [], {
    elbowAngle,
    bodyStraightAngle: straight.angle,
    torsoHorizontal,
    bodyLength
  }, count, side);
}

function analyzeSquat(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "hip", "knee", "ankle"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  if (!p.shoulder || !p.hip || !p.knee || !p.ankle) return invalid(prev, ctx, "squat", "Camera cần thấy vai - hông - gối - cổ chân để đếm squat.");

  const kneeAngle = calculateAngle(p.hip, p.knee, p.ankle);
  const hipAngle = calculateAngle(p.shoulder, p.hip, p.knee);
  const torsoLean = postureVertical(p.shoulder, p.hip);
  const hipToKneeY = p.hip.y - p.knee.y;
  const kneeTravel = Math.abs(p.knee.x - p.ankle.x);
  const errors: string[] = [];
  if (torsoLean > 48) errors.push("Giữ ngực mở, thân trên không gập quá sâu về trước.");
  if (kneeAngle < 150 && hipToKneeY < -0.11) errors.push("Hông chưa xuống đủ gần ngang gối.");
  if (kneeTravel > 0.22) errors.push("Kiểm soát đầu gối, tránh đổ quá xa so với cổ chân.");

  const depthScore = kneeAngle < 130 ? scoreMax(kneeAngle, 88, 145) : scoreMin(kneeAngle, 160, 130);
  const formScore = weighted([
    [scoreMax(torsoLean, 18, 55), 0.28],
    [depthScore, 0.4],
    [scoreMax(kneeTravel, 0.1, 0.25), 0.16],
    [scoreMin(hipAngle, 55, 25), 0.16]
  ]);
  const valid = errors.length <= 1 && formScore >= 52;
  if (!valid) return invalid(prev, ctx, "squat", "Chưa đạt điều kiện đếm squat.", errors, kneeAngle);

  let phase = prev.phase;
  let count = false;
  let feedback = "Giữ gót chân ổn định và tiếp tục.";
  if (kneeAngle <= (config.thresholds?.downAngle ?? 108) || hipToKneeY > -0.04) {
    phase = "down";
    feedback = "Độ sâu squat tốt, đứng lên kiểm soát.";
  } else if (kneeAngle >= (config.thresholds?.upAngle ?? 158)) {
    count = prev.phase === "down" && prev.validPose !== false;
    phase = "up";
    feedback = count ? "Hoàn thành 1 squat." : "Đứng thẳng, chuẩn bị xuống tiếp.";
  }
  return nextBase(prev, ctx, "squat", phase, kneeAngle, formScore, feedback, true, errors, { kneeAngle, hipAngle, torsoLean, hipToKneeY, kneeTravel }, count, side);
}

function analyzePlank(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "hip", "knee", "ankle"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  const end = p.ankle || p.knee;
  if (!p.shoulder || !p.hip || !end) return invalid(prev, ctx, "plank", "Camera cần thấy vai - hông - gối/cổ chân để đánh giá plank.");

  const straight = bodyStraightness(p.shoulder, p.hip, end);
  const torsoHorizontal = postureHorizontal(p.shoulder, p.hip);
  const errors: string[] = [];
  if (torsoHorizontal > 48) errors.push("Plank cần thân người gần song song mặt sàn.");
  if (straight.angle < 158) errors.push("Không võng lưng/nâng mông; giữ vai-hông-cổ chân thẳng hơn.");
  const formScore = weighted([[scoreMax(torsoHorizontal, 15, 55), 0.35], [straight.score, 0.45], [scoreMin(distance(p.shoulder, end), 0.32, 0.18), 0.2]]);
  const valid = !errors.length && formScore >= 62;
  const dt = Math.max(0, Math.min(0.25, ((ctx.now - (prev.lastFrameAt || ctx.now)) / 1000)));
  const holdSeconds = valid ? (prev.holdSeconds || 0) + dt : prev.holdSeconds || 0;
  if (!valid) return invalid(prev, ctx, "plank", "Chưa đạt tư thế plank.", errors, straight.angle);
  return nextBase(prev, ctx, "plank", "hold", straight.angle, formScore, `Plank tốt: đã giữ chuẩn ${Math.round(holdSeconds)} giây.`, true, [], { bodyStraightAngle: straight.angle, torsoHorizontal }, false, side, holdSeconds);
}

function analyzeJumpingJack(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const p = bothSidePoints(landmarks, ctx.minScore);
  if (!p.leftWrist || !p.rightWrist || !p.leftShoulder || !p.rightShoulder || !p.leftHip || !p.rightHip || !p.leftAnkle || !p.rightAnkle) {
    return invalid(prev, ctx, "jumping_jack", "Camera chính diện cần thấy hai tay, hai vai, hông và hai cổ chân.");
  }
  const shoulderWidth = Math.max(0.05, distance(p.leftShoulder, p.rightShoulder));
  const hipWidth = Math.max(0.05, distance(p.leftHip, p.rightHip));
  const wristDistance = distance(p.leftWrist, p.rightWrist) / shoulderWidth;
  const ankleDistance = distance(p.leftAnkle, p.rightAnkle) / hipWidth;
  const handsHigh = p.leftWrist.y < p.leftShoulder.y + 0.05 && p.rightWrist.y < p.rightShoulder.y + 0.05;
  const anklesWide = ankleDistance > 1.55;
  const closed = wristDistance < 2.3 && ankleDistance < 1.35 && !handsHigh;
  const open = handsHigh && anklesWide && wristDistance > 2.4;
  const formScore = weighted([[handsHigh || closed ? 90 : 40, 0.35], [scoreMin(wristDistance, 2.4, 1.4), 0.25], [scoreMin(ankleDistance, 1.55, 1.05), 0.25], [p.leftHip.y < p.leftAnkle.y && p.rightHip.y < p.rightAnkle.y ? 90 : 45, 0.15]]);
  let phase = prev.phase;
  let count = false;
  let feedback = "Mở rộng tay chân rồi khép lại đủ biên độ.";
  if (open) {
    phase = "open";
    feedback = "Tay/chân đã mở tốt, khép lại để hoàn thành rep.";
  } else if (closed) {
    count = prev.phase === "open";
    phase = "closed";
    feedback = count ? "Hoàn thành 1 jumping jack." : "Đang ở vị trí khép, mở tay chân lên.";
  }
  return nextBase(prev, ctx, "jumping_jack", phase, Math.round((wristDistance + ankleDistance) * 50), formScore, feedback, true, [], { wristDistance, ankleDistance, handsHigh: handsHigh ? 1 : 0 }, count, "both");
}

function analyzeLunge(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const p = bothSidePoints(landmarks, ctx.minScore);
  if (!p.leftHip || !p.rightHip || !p.leftKnee || !p.rightKnee || !p.leftAnkle || !p.rightAnkle || !p.leftShoulder || !p.rightShoulder) {
    return invalid(prev, ctx, "lunge", "Camera cần thấy vai, hông, gối và cổ chân của cả hai bên.");
  }
  const leftKneeAngle = calculateAngle(p.leftHip, p.leftKnee, p.leftAnkle);
  const rightKneeAngle = calculateAngle(p.rightHip, p.rightKnee, p.rightAnkle);
  const side: Side = leftKneeAngle <= rightKneeAngle ? "left" : "right";
  const frontAngle = Math.min(leftKneeAngle, rightKneeAngle);
  const backAngle = Math.max(leftKneeAngle, rightKneeAngle);
  const shoulder = midpoint(p.leftShoulder, p.rightShoulder)!;
  const hip = midpoint(p.leftHip, p.rightHip)!;
  const torsoLean = postureVertical(shoulder, hip);
  const ankleSpread = Math.abs(p.leftAnkle.x - p.rightAnkle.x) + Math.abs(p.leftAnkle.y - p.rightAnkle.y) * 0.35;
  const errors: string[] = [];
  if (torsoLean > 40) errors.push("Giữ thân trên thẳng, không đổ người quá nhiều.");
  if (ankleSpread < 0.12) errors.push("Bước chân xa hơn để tạo tư thế lunge rõ ràng.");
  const formScore = weighted([[scoreMax(frontAngle, 88, 140), 0.38], [scoreMin(backAngle, 115, 80), 0.2], [scoreMax(torsoLean, 14, 45), 0.24], [scoreMin(ankleSpread, 0.22, 0.08), 0.18]]);
  const valid = errors.length <= 1 && formScore >= 50;
  if (!valid) return invalid(prev, ctx, "lunge", "Chưa đạt điều kiện đếm lunge.", errors, frontAngle);
  let phase = prev.phase;
  let count = false;
  let feedback = "Xuống kiểm soát, gối trước gần 90 độ.";
  if (frontAngle <= 108) {
    phase = "down";
    feedback = "Độ sâu lunge tốt, đẩy lên.";
  } else if (frontAngle >= 155) {
    count = prev.phase === "down";
    phase = "up";
    feedback = count ? "Hoàn thành 1 lunge." : "Đứng lên, chuẩn bị nhịp tiếp.";
  }
  return nextBase(prev, ctx, "lunge", phase, frontAngle, formScore, feedback, true, errors, { leftKneeAngle, rightKneeAngle, torsoLean, ankleSpread }, count, side);
}

function analyzeBicepCurl(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "elbow", "wrist", "hip"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  if (!p.shoulder || !p.elbow || !p.wrist || !p.hip) return invalid(prev, ctx, "bicep_curl", "Camera cần thấy vai - khuỷu - cổ tay - hông của tay đang tập.");
  const elbowAngle = calculateAngle(p.shoulder, p.elbow, p.wrist);
  const torsoLean = postureVertical(p.shoulder, p.hip);
  const upperArmLean = angleFromVertical(p.shoulder, p.elbow);
  const elbowDrift = Math.abs(p.elbow.x - p.shoulder.x);
  const errors: string[] = [];
  if (torsoLean > 35) errors.push("Đứng/ngồi thẳng người hơn.");
  if (upperArmLean > 48 || elbowDrift > 0.18) errors.push("Giữ khuỷu gần thân, không đưa vai/khuỷu ra trước quá nhiều.");
  const formScore = weighted([[scoreMax(torsoLean, 12, 40), 0.25], [scoreMax(upperArmLean, 18, 55), 0.35], [scoreMax(elbowDrift, 0.08, 0.22), 0.18], [elbowAngle < 90 ? scoreMax(elbowAngle, 45, 100) : scoreMin(elbowAngle, 150, 90), 0.22]]);
  const valid = errors.length <= 1 && formScore >= 52;
  if (!valid) return invalid(prev, ctx, "bicep_curl", "Chưa đạt điều kiện đếm biceps curl.", errors, elbowAngle);
  let phase = prev.phase;
  let count = false;
  let feedback = "Chỉ gập cẳng tay, khuỷu giữ gần thân.";
  if (elbowAngle <= 68) {
    phase = "up";
    feedback = "Gập tay đủ cao, hạ xuống chậm.";
  } else if (elbowAngle >= 145) {
    count = prev.phase === "up";
    phase = "down";
    feedback = count ? "Hoàn thành 1 biceps curl." : "Duỗi tay xuống, chuẩn bị gập lên.";
  }
  return nextBase(prev, ctx, "bicep_curl", phase, elbowAngle, formScore, feedback, true, errors, { elbowAngle, torsoLean, upperArmLean, elbowDrift }, count, side);
}

function analyzeShoulderPress(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "elbow", "wrist", "hip"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  if (!p.shoulder || !p.elbow || !p.wrist || !p.hip) return invalid(prev, ctx, "shoulder_press", "Camera cần thấy vai - khuỷu - cổ tay để đếm shoulder press.");
  const elbowAngle = calculateAngle(p.shoulder, p.elbow, p.wrist);
  const torsoLean = postureVertical(p.shoulder, p.hip);
  const wristOverhead = p.wrist.y < p.shoulder.y - 0.05;
  const wristNearShoulder = Math.abs(p.wrist.y - p.shoulder.y) < 0.22;
  const errors: string[] = [];
  if (torsoLean > 35) errors.push("Giữ thân người thẳng, không ngả lưng quá nhiều.");
  const formScore = weighted([[scoreMax(torsoLean, 12, 42), 0.28], [wristOverhead ? 90 : wristNearShoulder ? 65 : 35, 0.28], [elbowAngle > 130 ? scoreMin(elbowAngle, 160, 120) : scoreClose(elbowAngle, 90, 45), 0.3], [p.elbow.y < p.hip.y ? 90 : 40, 0.14]]);
  const valid = errors.length === 0 && formScore >= 50;
  if (!valid) return invalid(prev, ctx, "shoulder_press", "Chưa đạt điều kiện đếm shoulder press.", errors, elbowAngle);
  let phase = prev.phase;
  let count = false;
  let feedback = "Đẩy qua đầu rồi hạ về ngang vai.";
  if (elbowAngle >= 152 && wristOverhead) {
    count = prev.phase === "down";
    phase = "up";
    feedback = count ? "Hoàn thành 1 shoulder press." : "Tay đã lên cao, hạ xuống kiểm soát.";
  } else if (elbowAngle <= 120 && wristNearShoulder) {
    phase = "down";
    feedback = "Vị trí dưới tốt, đẩy lên.";
  }
  return nextBase(prev, ctx, "shoulder_press", phase, elbowAngle, formScore, feedback, true, errors, { elbowAngle, torsoLean, wristOverhead: wristOverhead ? 1 : 0 }, count, side);
}

function analyzeLateralRaise(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "wrist", "hip"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  if (!p.shoulder || !p.wrist || !p.hip) return invalid(prev, ctx, "lateral_raise", "Camera cần thấy vai - cổ tay - hông để đếm lateral raise.");
  const armAngle = calculateAngle(p.hip, p.shoulder, p.wrist);
  const torsoLean = postureVertical(p.shoulder, p.hip);
  const wristAtShoulder = Math.abs(p.wrist.y - p.shoulder.y) < 0.12;
  const wristLow = p.wrist.y > p.hip.y - 0.08;
  const errors: string[] = [];
  if (torsoLean > 35) errors.push("Giữ thân thẳng, không nghiêng người lấy đà.");
  const formScore = weighted([[scoreMax(torsoLean, 12, 42), 0.3], [wristAtShoulder || wristLow ? 85 : 50, 0.25], [armAngle > 60 ? scoreClose(armAngle, 85, 40) : scoreMax(armAngle, 15, 60), 0.3], [Math.abs(p.wrist.x - p.shoulder.x) > 0.08 ? 80 : 45, 0.15]]);
  const valid = errors.length === 0 && formScore >= 50;
  if (!valid) return invalid(prev, ctx, "lateral_raise", "Chưa đạt điều kiện đếm lateral raise.", errors, armAngle);
  let phase = prev.phase;
  let count = false;
  let feedback = "Nâng tay đến ngang vai rồi hạ xuống chậm.";
  if (armAngle >= 68 && wristAtShoulder) {
    phase = "up";
    feedback = "Đã nâng tay ngang vai, hạ xuống có kiểm soát.";
  } else if (armAngle <= 32 && wristLow) {
    count = prev.phase === "up";
    phase = "down";
    feedback = count ? "Hoàn thành 1 lateral raise." : "Tay đã hạ, nâng lên tiếp.";
  }
  return nextBase(prev, ctx, "lateral_raise", phase, armAngle, formScore, feedback, true, errors, { armAngle, torsoLean }, count, side);
}

function analyzeCrunch(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "hip", "knee"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  if (!p.shoulder || !p.hip || !p.knee) return invalid(prev, ctx, "crunch", "Camera ngang thân cần thấy vai - hông - gối để đếm gập bụng.");
  const trunkAngle = calculateAngle(p.shoulder, p.hip, p.knee);
  const thighAngle = segmentAngleFromHorizontal(p.hip, p.knee);
  const errors: string[] = [];
  if (thighAngle < 15) errors.push("Co gối rõ hơn để AI phân biệt động tác gập bụng.");
  const formScore = weighted([[trunkAngle < 90 ? scoreMax(trunkAngle, 55, 100) : scoreMin(trunkAngle, 118, 80), 0.6], [scoreMin(thighAngle, 30, 5), 0.25], [scoreMin(distance(p.shoulder, p.knee), 0.22, 0.08), 0.15]]);
  const valid = errors.length === 0 && formScore >= 45;
  if (!valid) return invalid(prev, ctx, "crunch", "Chưa đạt điều kiện đếm crunch/sit-up.", errors, trunkAngle);
  let phase = prev.phase;
  let count = false;
  let feedback = "Gập bụng lên rồi hạ xuống chậm.";
  if (trunkAngle <= 78) {
    phase = "up";
    feedback = "Gập lên tốt, hạ xuống kiểm soát.";
  } else if (trunkAngle >= 112) {
    count = prev.phase === "up";
    phase = "down";
    feedback = count ? "Hoàn thành 1 crunch/sit-up." : "Hạ người, chuẩn bị gập lên.";
  }
  return nextBase(prev, ctx, "crunch", phase, trunkAngle, formScore, feedback, true, errors, { trunkAngle, thighAngle }, count, side);
}

function analyzeMountainClimber(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const c = bodyCenters(landmarks, ctx.minScore);
  if (!c.shoulder || !c.hip || !c.leftKnee || !c.rightKnee || !c.leftAnkle || !c.rightAnkle) {
    return invalid(prev, ctx, "mountain_climber", "Camera cần thấy vai - hông - gối - cổ chân để đếm mountain climber.");
  }
  const torsoHorizontal = postureHorizontal(c.shoulder, c.hip);
  const leftDrive = distance(c.leftKnee, c.shoulder);
  const rightDrive = distance(c.rightKnee, c.shoulder);
  const leftExtended = distance(c.leftKnee, c.leftAnkle);
  const rightExtended = distance(c.rightKnee, c.rightAnkle);
  const errors: string[] = [];
  if (torsoHorizontal > 52) errors.push("Giữ nền plank ngang hơn trước khi kéo gối.");
  const drivingLeft = leftDrive + 0.03 < rightDrive && leftDrive < 0.34;
  const drivingRight = rightDrive + 0.03 < leftDrive && rightDrive < 0.34;
  const formScore = weighted([[scoreMax(torsoHorizontal, 20, 58), 0.35], [drivingLeft || drivingRight ? 90 : 45, 0.3], [scoreMin(Math.max(leftExtended, rightExtended), 0.11, 0.04), 0.15], [scoreMin(distance(c.shoulder, c.hip), 0.15, 0.06), 0.2]]);
  const valid = !errors.length && formScore >= 52;
  if (!valid) return invalid(prev, ctx, "mountain_climber", "Chưa đạt điều kiện đếm mountain climber.", errors, Math.round(Math.min(leftDrive, rightDrive) * 100));
  let phase = prev.phase;
  let count = false;
  let feedback = "Luân phiên kéo gối về phía ngực, giữ plank ổn định.";
  if (drivingLeft) {
    count = prev.phase === "right" || prev.phase === "ready" || prev.phase === "up";
    phase = "left";
    feedback = count ? "Đếm 1 lần kéo gối trái." : "Gối trái đang kéo về ngực.";
  } else if (drivingRight) {
    count = prev.phase === "left" || prev.phase === "ready" || prev.phase === "up";
    phase = "right";
    feedback = count ? "Đếm 1 lần kéo gối phải." : "Gối phải đang kéo về ngực.";
  } else {
    phase = "ready";
  }
  return nextBase(prev, ctx, "mountain_climber", phase, Math.round(Math.min(leftDrive, rightDrive) * 100), formScore, feedback, true, errors, { torsoHorizontal, leftDrive, rightDrive }, count, "both");
}

function analyzeHighKnees(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const c = bodyCenters(landmarks, ctx.minScore);
  if (!c.shoulder || !c.hip || !c.leftKnee || !c.rightKnee || !c.leftAnkle || !c.rightAnkle) return invalid(prev, ctx, "high_knees", "Camera chính diện cần thấy vai - hông - hai gối - hai cổ chân.");
  const torsoLean = postureVertical(c.shoulder, c.hip);
  const leftLift = c.hip.y - c.leftKnee.y;
  const rightLift = c.hip.y - c.rightKnee.y;
  const errors: string[] = [];
  if (torsoLean > 35) errors.push("Giữ thân thẳng, không gập người về trước.");
  const leftHigh = leftLift > -0.02;
  const rightHigh = rightLift > -0.02;
  const formScore = weighted([[scoreMax(torsoLean, 10, 40), 0.35], [leftHigh || rightHigh ? 90 : 45, 0.4], [scoreMin(distance(c.leftAnkle, c.rightAnkle), 0.08, 0.02), 0.25]]);
  const valid = errors.length === 0 && formScore >= 50;
  if (!valid) return invalid(prev, ctx, "high_knees", "Chưa đạt điều kiện đếm nâng cao đùi.", errors, Math.round(Math.max(leftLift, rightLift) * 100));
  let phase = prev.phase;
  let count = false;
  let feedback = "Luân phiên nâng gối lên gần ngang hông.";
  if (leftHigh && leftLift > rightLift + 0.04) {
    count = prev.phase === "right" || prev.phase === "ready";
    phase = "left";
    feedback = count ? "Đếm 1 lần nâng gối trái." : "Gối trái đã lên cao.";
  } else if (rightHigh && rightLift > leftLift + 0.04) {
    count = prev.phase === "left" || prev.phase === "ready";
    phase = "right";
    feedback = count ? "Đếm 1 lần nâng gối phải." : "Gối phải đã lên cao.";
  } else {
    phase = "ready";
  }
  return nextBase(prev, ctx, "high_knees", phase, Math.round(Math.max(leftLift, rightLift) * 100), formScore, feedback, true, errors, { torsoLean, leftLift, rightLift }, count, "both");
}

function analyzeDeadlift(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "hip", "knee", "ankle"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  if (!p.shoulder || !p.hip || !p.knee || !p.ankle) return invalid(prev, ctx, "deadlift", "Camera ngang thân cần thấy vai - hông - gối - cổ chân để đếm deadlift.");
  const hipAngle = calculateAngle(p.shoulder, p.hip, p.knee);
  const kneeAngle = calculateAngle(p.hip, p.knee, p.ankle);
  const backAngle = segmentAngleFromHorizontal(p.shoulder, p.hip);
  const errors: string[] = [];
  if (kneeAngle < 115) errors.push("Đây đang giống squat; deadlift cần hinge bằng hông, gối không gập quá sâu.");
  const formScore = weighted([[hipAngle < 135 ? scoreMax(hipAngle, 95, 150) : scoreMin(hipAngle, 165, 130), 0.42], [scoreMin(kneeAngle, 130, 100), 0.28], [scoreMin(backAngle, 25, 5), 0.16], [scoreMin(distance(p.shoulder, p.ankle), 0.32, 0.18), 0.14]]);
  const valid = errors.length === 0 && formScore >= 50;
  if (!valid) return invalid(prev, ctx, "deadlift", "Chưa đạt điều kiện đếm deadlift.", errors, hipAngle);
  let phase = prev.phase;
  let count = false;
  let feedback = "Hinge bằng hông, giữ lưng thẳng.";
  if (hipAngle <= 122) {
    phase = "down";
    feedback = "Đã hinge xuống, kéo hông lên để đứng thẳng.";
  } else if (hipAngle >= 160) {
    count = prev.phase === "down";
    phase = "up";
    feedback = count ? "Hoàn thành 1 deadlift." : "Đứng thẳng, chuẩn bị hinge xuống.";
  }
  return nextBase(prev, ctx, "deadlift", phase, hipAngle, formScore, feedback, true, errors, { hipAngle, kneeAngle, backAngle }, count, side);
}

function analyzeGluteBridge(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const side = chooseSide(landmarks, ["shoulder", "hip", "knee"], ctx.minScore);
  const p = sidePoints(landmarks, side, ctx.minScore);
  if (!p.shoulder || !p.hip || !p.knee) return invalid(prev, ctx, "glute_bridge", "Camera ngang thân cần thấy vai - hông - gối để đếm glute bridge.");
  const bridgeAngle = calculateAngle(p.shoulder, p.hip, p.knee);
  const hipHigh = p.hip.y < Math.max(p.shoulder.y, p.knee.y) + 0.04;
  const formScore = weighted([[scoreClose(bridgeAngle, 175, 35), 0.55], [hipHigh ? 90 : 45, 0.3], [scoreMin(distance(p.shoulder, p.knee), 0.22, 0.09), 0.15]]);
  let phase = prev.phase;
  let count = false;
  let feedback = "Nâng hông lên tạo đường thẳng vai-hông-gối rồi hạ xuống.";
  if (bridgeAngle >= 158 && hipHigh) {
    phase = "up";
    feedback = "Hông đã lên cao, siết mông rồi hạ xuống.";
  } else if (bridgeAngle <= 128) {
    count = prev.phase === "up";
    phase = "down";
    feedback = count ? "Hoàn thành 1 glute bridge." : "Hông đã hạ, nâng lên tiếp.";
  }
  return nextBase(prev, ctx, "glute_bridge", phase, bridgeAngle, formScore, feedback, true, [], { bridgeAngle, hipHigh: hipHigh ? 1 : 0 }, count, side);
}

function analyzeConfiguredAngle(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const [p1, p2, p3] = config.points || [];
  const a = getLandmark(landmarks, p1, ctx.minScore);
  const b = getLandmark(landmarks, p2, ctx.minScore);
  const c = getLandmark(landmarks, p3, ctx.minScore);
  if (!a || !b || !c) return invalid(prev, ctx, "angle", config.missingFeedback || "Đứng xa camera hơn để AI thấy đủ 3 điểm khớp chính.");

  const metric = calculateAngle(a, b, c);
  const down = matchRule(metric, config.downRule);
  const up = matchRule(metric, config.upRule);
  let phase = prev.phase;
  let count = false;
  let feedback = config.warningFeedback || "Giữ đúng tư thế và tiếp tục.";
  if (down) {
    phase = "down";
    feedback = config.downRule?.feedback || "Đã tới pha xuống, chuẩn bị quay lại.";
  } else if (up) {
    count = prev.phase === "down";
    phase = "up";
    feedback = count ? "Hoàn thành 1 rep." : config.upRule?.feedback || "Đã tới pha lên, tiếp tục.";
  }

  const downTarget = config.downRule?.value ?? 100;
  const upTarget = config.upRule?.value ?? 160;
  const expected = phase === "down" ? downTarget : upTarget;
  const accuracy = Math.round(Math.max(35, Math.min(100, 100 - Math.abs(metric - expected) * 0.9)));
  return nextBase(prev, ctx, "angle", phase, metric, accuracy, feedback, true, [], { metric }, count);
}

function analyzeVertical(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, ctx: PoseContext): AnalysisState {
  const point = getLandmark(landmarks, config.point || "nose", ctx.minScore);
  if (!point) return invalid(prev, ctx, "vertical", config.missingFeedback || "Camera chưa thấy rõ cơ thể.");
  const metric = Math.round(point.y * 100);
  const threshold = config.threshold ?? 40;
  let phase: AnalysisState["phase"] = metric > threshold ? "down" : "up";
  const count = prev.phase === "down" && phase === "up";
  const feedback = phase === "down" ? (config.downFeedback || "Ổn định, tiếp tục giữ.") : (count ? "Hoàn thành 1 nhịp." : config.upFeedback || "Tốt, giữ thêm.");
  return nextBase(prev, ctx, "vertical", phase, metric, Math.min(100, Math.max(45, 100 - Math.abs(metric - threshold))), feedback, true, [], { metric }, count);
}

export function nextAnalysisState(prev: AnalysisState, landmarks: Landmark[], config: ExerciseAiConfig, timestampMs?: number): AnalysisState {
  const ctx: PoseContext = {
    now: timestampMs ?? Date.now(),
    minScore: config.minScore ?? 0.35,
    targetRepsPerSet: config.targetRepsPerSet ?? 12,
    minRepIntervalMs: config.minRepIntervalMs ?? 650
  };
  const mode = inferMode(null, config);
  if (!landmarks.length) return invalid(prev, ctx, mode, "MoveNet chưa thấy cơ thể. Hãy đứng xa hơn và bật đủ ánh sáng.");

  switch (mode) {
    case "pushup": return analyzePushup(prev, landmarks, config, ctx);
    case "squat": return analyzeSquat(prev, landmarks, config, ctx);
    case "plank": return analyzePlank(prev, landmarks, config, ctx);
    case "jumping_jack": return analyzeJumpingJack(prev, landmarks, config, ctx);
    case "lunge": return analyzeLunge(prev, landmarks, config, ctx);
    case "bicep_curl": return analyzeBicepCurl(prev, landmarks, config, ctx);
    case "shoulder_press": return analyzeShoulderPress(prev, landmarks, config, ctx);
    case "lateral_raise": return analyzeLateralRaise(prev, landmarks, config, ctx);
    case "crunch": return analyzeCrunch(prev, landmarks, config, ctx);
    case "mountain_climber": return analyzeMountainClimber(prev, landmarks, config, ctx);
    case "high_knees": return analyzeHighKnees(prev, landmarks, config, ctx);
    case "deadlift": return analyzeDeadlift(prev, landmarks, config, ctx);
    case "glute_bridge": return analyzeGluteBridge(prev, landmarks, config, ctx);
    case "vertical": return analyzeVertical(prev, landmarks, config, ctx);
    case "angle":
    default: return analyzeConfiguredAngle(prev, landmarks, config, ctx);
  }
}

export function initialAnalysisState(): AnalysisState {
  return {
    reps: 0,
    sets: 0,
    phase: "hold",
    metric: 0,
    accuracy: 0,
    feedback: "Chọn bài tập và bật camera để bắt đầu.",
    lastChangedAt: Date.now(),
    validPose: false,
    formScore: 0,
    errors: [],
    mode: "",
    holdSeconds: 0,
    currentSetReps: 0,
    targetRepsPerSet: 12,
    lastRepAt: 0,
    lastFrameAt: Date.now(),
    rawMetrics: {}
  };
}

export function drawPose(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks: Landmark[] = []) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = video.videoWidth || video.clientWidth || canvas.clientWidth || 640;
  const height = video.videoHeight || video.clientHeight || canvas.clientHeight || 480;
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  if (!landmarks.length) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 6;

  ctx.lineWidth = Math.max(3, width / 260);
  ctx.strokeStyle = "rgba(34, 211, 238, 0.95)";
  for (const [from, to] of poseConnections) {
    const a = getLandmark(landmarks, from, 0.2);
    const b = getLandmark(landmarks, to, 0.2);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  const leftShoulder = getLandmark(landmarks, "left_shoulder", 0.2);
  const rightShoulder = getLandmark(landmarks, "right_shoulder", 0.2);
  const leftHip = getLandmark(landmarks, "left_hip", 0.2);
  const rightHip = getLandmark(landmarks, "right_hip", 0.2);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  if (shoulderCenter && hipCenter) {
    ctx.lineWidth = Math.max(5, width / 160);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
    ctx.beginPath();
    ctx.moveTo(shoulderCenter.x * width, shoulderCenter.y * height);
    ctx.lineTo(hipCenter.x * width, hipCenter.y * height);
    ctx.stroke();
  }

  ctx.shadowBlur = 4;
  for (const point of landmarks) {
    const score = point.visibility ?? point.score ?? 1;
    if (score < 0.2) continue;
    const radius = Math.max(5, width / 170);
    ctx.beginPath();
    ctx.fillStyle = score >= 0.45 ? "rgba(14, 165, 233, 0.96)" : "rgba(250, 204, 21, 0.9)";
    ctx.arc(point.x * width, point.y * height, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.stroke();
  }
  ctx.restore();
}

export function clearPose(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function estimateUploadedVideoResult(exercise: Exercise | null, durationSeconds: number) {
  const name = normalizeText(exercise?.name || "");
  const isHold = name.includes("plank");
  const secondsPerRep = isHold ? 10 : name.includes("push") || name.includes("chong day") || name.includes("hit dat") ? 3.2 : 3.5;
  const reps = isHold ? 0 : Math.max(0, Math.round(durationSeconds / secondsPerRep));
  const sets = completedSetCount(reps, 12);
  const accuracy = isHold ? 82 : 78;
  const calories = Math.max(1, Math.round((durationSeconds / 60) * (exercise?.caloriesPerMinute || 5)));
  return { reps, sets, accuracy, calories };
}

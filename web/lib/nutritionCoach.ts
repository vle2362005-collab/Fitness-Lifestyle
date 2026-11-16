import type { Food, MedicalProfile, NutritionLog, NutritionSummary, WorkoutAnalysis, WorkoutSession } from "@/lib/types";

export type MealKey = 0 | 1 | 2 | 3;

export const MEAL_TYPES: Array<{ value: MealKey; label: string; shortLabel: string; ratio: number; role: string }> = [
  { value: 0, label: "Bữa sáng", shortLabel: "Sáng", ratio: 0.25, role: "nạp năng lượng đầu ngày" },
  { value: 1, label: "Bữa trưa", shortLabel: "Trưa", ratio: 0.35, role: "bữa chính nhiều năng lượng nhất" },
  { value: 2, label: "Bữa tối", shortLabel: "Tối", ratio: 0.30, role: "đủ đạm, vừa tinh bột" },
  { value: 3, label: "Bữa phụ", shortLabel: "Phụ", ratio: 0.10, role: "lấp khoảng thiếu calories/macro" }
];

export type NutritionGoal = "weightLoss" | "maintenance" | "muscleGain";

export interface MacroTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinMin: number;
  proteinMax: number;
  carbsMin: number;
  carbsMax: number;
  fatMin: number;
  fatMax: number;
  waterMl: number;
  goal: NutritionGoal;
  goalLabel: string;
  hasProfile: boolean;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealProgress {
  value: MealKey;
  label: string;
  shortLabel: string;
  role: string;
  targetCalories: number;
  calories: number;
  delta: number;
  percent: number;
  status: "missing" | "balanced" | "over";
  logs: NutritionLog[];
}

export interface FoodRecommendation {
  food: Food;
  reason: string;
  score: number;
  suggestedQuantity: number;
  targetMeal: MealKey;
}

export interface NutritionCoachResult {
  target: MacroTarget;
  totals: NutritionTotals;
  remaining: NutritionTotals;
  mealProgress: MealProgress[];
  recommendations: FoodRecommendation[];
  messages: Array<{ type: "success" | "warning" | "danger" | "info"; title: string; text: string }>;
  score: number;
  trainingCaloriesToday: number;
  trainingMinutesToday: number;
}

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function pct(value: number, target: number) {
  if (!target) return 0;
  return clamp(Math.round((value / target) * 100), 0, 160);
}

export function normalizeGoal(goal?: string | number | null): NutritionGoal {
  if (typeof goal === "number") {
    if (goal === 0) return "weightLoss";
    if (goal === 2) return "muscleGain";
    return "maintenance";
  }
  const g = String(goal || "").toLowerCase();
  if (g.includes("loss") || g.includes("giảm") || g.includes("weightloss")) return "weightLoss";
  if (g.includes("gain") || g.includes("tăng") || g.includes("muscle")) return "muscleGain";
  return "maintenance";
}

export function goalLabel(goal: NutritionGoal) {
  if (goal === "weightLoss") return "Giảm mỡ / giảm cân";
  if (goal === "muscleGain") return "Tăng cơ / tăng vóc dáng";
  return "Duy trì vóc dáng";
}

export function calculateMacroTarget(profile: MedicalProfile | null): MacroTarget {
  const hasProfile = Boolean(profile?.tdee && profile?.weight);
  const goal = normalizeGoal(profile?.goal);
  const calories = Math.max(1200, Math.round(n(profile?.tdee, 2000)));
  const weight = Math.max(40, n(profile?.weight, 65));

  const proteinPerKg = goal === "weightLoss" ? 1.8 : goal === "muscleGain" ? 1.9 : 1.6;
  const fatPerKg = goal === "weightLoss" ? 0.75 : goal === "muscleGain" ? 0.85 : 0.8;

  const protein = Math.round(weight * proteinPerKg);
  const fat = Math.round(weight * fatPerKg);
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    calories,
    protein,
    carbs,
    fat,
    proteinMin: Math.round(weight * 1.4),
    proteinMax: Math.round(weight * 2.2),
    carbsMin: Math.max(60, Math.round(carbs * 0.75)),
    carbsMax: Math.round(carbs * 1.25),
    fatMin: Math.round(weight * 0.55),
    fatMax: Math.round(weight * 1.05),
    waterMl: Math.round(weight * 35),
    goal,
    goalLabel: goalLabel(goal),
    hasProfile
  };
}

export function extractTotals(summary: NutritionSummary | null): NutritionTotals {
  return {
    calories: Math.round(n(summary?.totalCalories)),
    protein: round(n(summary?.totalProtein), 1),
    carbs: round(n(summary?.totalCarbs), 1),
    fat: round(n(summary?.totalFat), 1)
  };
}

export function mealValue(value: unknown): MealKey {
  const num = Number(value);
  return ([0, 1, 2, 3].includes(num) ? num : 3) as MealKey;
}

export function mealLabel(value: unknown) {
  return MEAL_TYPES.find((m) => m.value === mealValue(value))?.shortLabel || "Khác";
}

export function dateInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function entryDate(value?: string | null) {
  if (!value) return dateInputValue();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateInputValue();
  return dateInputValue(date);
}

export function buildMealProgress(summary: NutritionSummary | null, target: MacroTarget): MealProgress[] {
  const logs = summary?.logs || [];
  return MEAL_TYPES.map((meal) => {
    const mealLogs = logs.filter((log) => mealValue(log.mealType) === meal.value);
    const calories = Math.round(mealLogs.reduce((sum, log) => sum + n(log.calories), 0));
    const targetCalories = Math.round(target.calories * meal.ratio);
    const delta = targetCalories - calories;
    const ratio = targetCalories ? calories / targetCalories : 0;
    return {
      ...meal,
      targetCalories,
      calories,
      delta,
      percent: pct(calories, targetCalories),
      status: ratio < 0.75 ? "missing" : ratio > 1.18 ? "over" : "balanced",
      logs: mealLogs
    };
  });
}

export function classifyFood(food: Food) {
  const calories = Math.max(1, n(food.calories));
  const proteinKcal = n(food.protein) * 4;
  const carbsKcal = n(food.carbs) * 4;
  const fatKcal = n(food.fat) * 9;
  const proteinRatio = proteinKcal / calories;
  const carbsRatio = carbsKcal / calories;
  const fatRatio = fatKcal / calories;
  return { proteinRatio, carbsRatio, fatRatio };
}

function macroGap(totals: NutritionTotals, target: MacroTarget) {
  return {
    calories: target.calories - totals.calories,
    protein: target.protein - totals.protein,
    carbs: target.carbs - totals.carbs,
    fat: target.fat - totals.fat
  };
}

function suggestedQuantity(food: Food, caloriesGap: number) {
  const calories = Math.max(1, n(food.calories));
  if (caloriesGap <= 0) return 1;
  return clamp(round(caloriesGap / calories, 1), 0.5, 2);
}

export function recommendFoods(foods: Food[], totals: NutritionTotals, target: MacroTarget, meals: MealProgress[]): FoodRecommendation[] {
  const gap = macroGap(totals, target);
  const targetMeal = meals.find((meal) => meal.status === "missing")?.value ?? 3;
  return foods
    .filter((food) => n(food.calories) > 0)
    .map((food) => {
      const ratios = classifyFood(food);
      let score = 0;
      const reasons: string[] = [];
      if (gap.protein > 10 && ratios.proteinRatio >= 0.22) {
        score += 38 + ratios.proteinRatio * 30;
        reasons.push("bù protein");
      }
      if (gap.carbs > 25 && ratios.carbsRatio >= 0.35) {
        score += 24 + ratios.carbsRatio * 18;
        reasons.push("bổ sung năng lượng tập");
      }
      if (gap.fat > 10 && ratios.fatRatio >= 0.25 && ratios.fatRatio <= 0.65) {
        score += 18 + ratios.fatRatio * 12;
        reasons.push("cân bằng chất béo");
      }
      if (gap.calories > 150 && n(food.calories) <= gap.calories * 1.25) score += 16;
      if (target.goal === "weightLoss" && n(food.protein) >= 12 && n(food.calories) <= 260) score += 16;
      if (target.goal === "muscleGain" && n(food.calories) >= 180 && n(food.protein) >= 10) score += 16;
      if (!reasons.length) {
        if (n(food.protein) >= 10) reasons.push("giữ đạm ổn định");
        else if (n(food.calories) <= 180) reasons.push("bữa phụ nhẹ");
        else reasons.push("bổ sung khẩu phần");
      }
      return {
        food,
        reason: reasons.slice(0, 2).join(" · "),
        score,
        suggestedQuantity: suggestedQuantity(food, Math.max(0, gap.calories)),
        targetMeal
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

export function todayTrainingStats(date: string, workouts: WorkoutSession[], analyses: WorkoutAnalysis[]) {
  const workoutSessionIdsFromAnalysis = new Set(
    analyses
      .filter((a) => entryDate(a.createdAt) === date)
      .map((a) => a.workoutSessionId)
      .filter((id): id is number => typeof id === "number" && id > 0)
  );
  const analysisOnly = analyses.filter((a) => entryDate(a.createdAt) === date && !a.workoutSessionId);
  const standaloneWorkouts = workouts.filter((w) => entryDate(w.performedAt || w.date) === date && !workoutSessionIdsFromAnalysis.has(w.id));
  const calories = [...analysisOnly, ...standaloneWorkouts].reduce((sum, item: any) => sum + n(item.caloriesBurned), 0);
  const seconds = analysisOnly.reduce((sum, item) => sum + n(item.durationInSeconds), 0)
    + standaloneWorkouts.reduce((sum, item) => sum + n(item.durationInSeconds) || n(item.durationMinutes) * 60, 0);
  return { calories: Math.round(calories), minutes: Math.round(seconds / 60) };
}

export function nutritionScore(totals: NutritionTotals, target: MacroTarget, mealProgress: MealProgress[]) {
  const calorieDiffPct = Math.abs(totals.calories - target.calories) / target.calories;
  const proteinDiffPct = Math.abs(totals.protein - target.protein) / Math.max(1, target.protein);
  const carbsDiffPct = Math.abs(totals.carbs - target.carbs) / Math.max(1, target.carbs);
  const fatDiffPct = Math.abs(totals.fat - target.fat) / Math.max(1, target.fat);
  const mealPenalty = mealProgress.filter((m) => m.status !== "balanced").length * 4;
  const raw = 100 - calorieDiffPct * 34 - proteinDiffPct * 26 - carbsDiffPct * 16 - fatDiffPct * 16 - mealPenalty;
  return clamp(Math.round(raw), 0, 100);
}

export function buildMessages(
  totals: NutritionTotals,
  target: MacroTarget,
  meals: MealProgress[],
  trainingCaloriesToday: number,
  trainingMinutesToday: number
): NutritionCoachResult["messages"] {
  const messages: NutritionCoachResult["messages"] = [];
  const remaining = macroGap(totals, target);
  const caloriePct = totals.calories / target.calories;

  if (!target.hasProfile) {
    messages.push({ type: "warning", title: "Cần hoàn thiện hồ sơ sức khỏe", text: "Hãy nhập chiều cao, cân nặng, tuổi, mức vận động và mục tiêu để hệ thống tính calories/macro sát hơn." });
  }

  if (caloriePct < 0.75) {
    messages.push({ type: "warning", title: "Calories còn thiếu khá nhiều", text: `Bạn còn khoảng ${Math.max(0, Math.round(remaining.calories))} kcal. Hãy thêm một bữa chính hoặc bữa phụ giàu đạm để tránh hụt năng lượng.` });
  } else if (caloriePct > 1.12) {
    messages.push({ type: "danger", title: "Đã vượt mục tiêu calories", text: "Các bữa còn lại nên ưu tiên rau, đạm nạc và hạn chế món nhiều dầu/đường để không lệch mục tiêu vóc dáng." });
  } else {
    messages.push({ type: "success", title: "Calories đang trong vùng hợp lý", text: "Mức nạp hôm nay khá sát mục tiêu. Hãy kiểm tra thêm protein, carbs và fat để khẩu phần cân bằng hơn." });
  }

  if (remaining.protein > 15) {
    messages.push({ type: "info", title: "Cần ưu tiên protein", text: `Bạn còn thiếu khoảng ${Math.round(remaining.protein)}g protein. Nên chọn món giàu đạm do Admin đã thêm như thịt nạc, trứng, cá, sữa chua hoặc đậu phụ.` });
  } else if (remaining.protein < -25) {
    messages.push({ type: "warning", title: "Protein đã khá cao", text: "Không cần ép thêm đạm ở các bữa sau. Hãy cân bằng bằng rau, tinh bột tốt và đủ nước." });
  }

  const skippedMeals = meals.filter((meal) => meal.logs.length === 0).map((meal) => meal.shortLabel);
  if (skippedMeals.length >= 2) {
    messages.push({ type: "warning", title: "Phân bổ bữa chưa đều", text: `Bạn đang bỏ trống bữa ${skippedMeals.join(", ")}. Chia nhỏ bữa giúp năng lượng ổn định hơn khi tập luyện.` });
  }

  if (trainingMinutesToday >= 20 && remaining.calories > 250) {
    messages.push({ type: "info", title: "Có tập luyện hôm nay", text: `Bạn đã tập khoảng ${trainingMinutesToday} phút và đốt ước tính ${trainingCaloriesToday} kcal. Nên bù năng lượng bằng bữa giàu protein + carb tốt sau tập.` });
  }

  return messages.slice(0, 5);
}

export function buildNutritionCoach(params: {
  profile: MedicalProfile | null;
  summary: NutritionSummary | null;
  foods: Food[];
  date: string;
  workouts?: WorkoutSession[];
  analyses?: WorkoutAnalysis[];
}): NutritionCoachResult {
  const target = calculateMacroTarget(params.profile);
  const totals = extractTotals(params.summary);
  const mealProgress = buildMealProgress(params.summary, target);
  const recommendations = recommendFoods(params.foods, totals, target, mealProgress);
  const training = todayTrainingStats(params.date, params.workouts || [], params.analyses || []);
  const score = nutritionScore(totals, target, mealProgress);
  const remaining = {
    calories: Math.round(target.calories - totals.calories),
    protein: round(target.protein - totals.protein, 1),
    carbs: round(target.carbs - totals.carbs, 1),
    fat: round(target.fat - totals.fat, 1)
  };
  return {
    target,
    totals,
    remaining,
    mealProgress,
    recommendations,
    messages: buildMessages(totals, target, mealProgress, training.calories, training.minutes),
    score,
    trainingCaloriesToday: training.calories,
    trainingMinutesToday: training.minutes
  };
}

export function macroStatus(value: number, min: number, max: number) {
  if (value < min) return "Thiếu";
  if (value > max) return "Vượt";
  return "Ổn";
}

export function scoreLabel(score: number) {
  if (score >= 85) return "Rất tốt";
  if (score >= 70) return "Ổn, cần chỉnh nhẹ";
  if (score >= 50) return "Cần cân bằng lại";
  return "Cần cải thiện hôm nay";
}

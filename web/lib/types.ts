export type Role = "Admin" | "User" | "admin" | "user" | string;

export interface UserSession {
  token: string;
  userId: number;
  username: string;
  email?: string;
  role: Role;
}

export interface Exercise {
  id: number;
  name: string;
  description?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  metValue?: number;
  aiConfig?: string | null;
  poseAngles?: string | null;
  caloriesPerMinute: number;
}

export interface Food {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  imageUrl?: string | null;
}

export interface NutritionLog {
  id: number;
  userId: number;
  foodId: number;
  foodName?: string;
  date: string;
  logDate?: string;
  mealType: string | number;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  food?: Food;
}

export interface NutritionSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  logs: NutritionLog[];
}

export interface WorkoutSession {
  id: number;
  exerciseId: number;
  exerciseName?: string;
  exerciseImageUrl?: string;
  durationMinutes: number;
  durationInSeconds: number;
  reps: number;
  sets: number;
  caloriesBurned: number;
  accuracyScore: number;
  date: string;
  performedAt?: string;
}

export interface WorkoutAnalysis {
  id: number;
  exerciseId: number;
  exerciseName?: string;
  workoutSessionId?: number | null;
  analysisType?: string;
  videoName?: string | null;
  videoUrl?: string | null;
  totalReps: number;
  totalSets: number;
  durationInSeconds: number;
  caloriesBurned: number;
  accuracyScore: number;
  feedbackSummary?: string | null;
  detectedErrorsJson?: string | null;
  rawResultJson?: string | null;
  status?: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalWorkouts: number;
  totalWorkoutSessions: number;
  totalAnalysisOnly: number;
  caloriesBurned: number;
  totalMinutes: number;
  totalReps: number;
  totalSets: number;
  averageAccuracy: number;
  recentWorkouts: WorkoutSession[];
  recentAnalyses: WorkoutAnalysis[];
}

export interface MedicalProfile {
  userId: number;
  height: number;
  weight: number;
  age: number;
  gender: string | number;
  activityLevel: string | number;
  goal: string | number;
  bmi: number;
  bmr: number;
  tdee: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Badge {
  id: number;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
}

export interface UserBadge {
  id: number;
  badgeId: number;
  earnedAt: string;
  badge?: Badge;
}

export interface AdminStats {
  totalUsers: number;
  totalExercises: number;
  totalWorkoutSessions: number;
  totalAnalyses: number;
  totalNutritionLogs: number;
  totalCaloriesBurned: number;
}

export interface ApiErrorPayload {
  message?: string;
  error?: string;
  title?: string;
  errors?: Record<string, string[]>;
}

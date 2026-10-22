import { activityById } from "./exercises";

// ---------- Năng lượng nền ----------

/** BMR theo Mifflin-St Jeor (kcal/ngày). */
export function bmrMifflin(sex: "male" | "female", weightKg: number, heightCm: number, age: number) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
}

export type ProfileLike = {
  sex: "male" | "female";
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmr_override: number | null;
  activity_factor: number;
};

/** BMR dùng để tính: ưu tiên số đo InBody, nếu không có thì tính theo công thức. */
export function effectiveBmr(p: ProfileLike, today = new Date()): number | null {
  if (p.bmr_override) return p.bmr_override;
  if (!p.birth_year || !p.height_cm || !p.weight_kg) return null;
  return Math.round(bmrMifflin(p.sex, p.weight_kg, p.height_cm, today.getFullYear() - p.birth_year));
}

// ---------- Vận động ----------

/** kcal ròng (đã trừ phần nghỉ) cho một hoạt động MET. */
export function metKcal(met: number, weightKg: number, minutes: number) {
  return Math.max(0, met - 1) * weightKg * (minutes / 60);
}

/**
 * Phương trình chuyển hóa ACSM cho đi bộ / chạy, có độ dốc.
 *  Đi bộ (< 8 km/h): VO2 = 3,5 + 0,1·S + 1,8·S·G
 *  Chạy  (≥ 8 km/h): VO2 = 3,5 + 0,2·S + 0,9·S·G
 *  S: m/phút, G: độ dốc dạng thập phân, VO2: ml/kg/phút. 1 lít O2 ≈ 5 kcal.
 * Trả về kcal ròng (trừ 3,5 ml/kg/phút lúc nghỉ, vì đã nằm trong BMR).
 */
export function acsmKcal(speedKmh: number, inclinePct: number, weightKg: number, minutes: number) {
  const s = (speedKmh * 1000) / 60;
  const g = inclinePct / 100;
  const running = speedKmh >= 8;
  const netVo2 = running ? 0.2 * s + 0.9 * s * g : 0.1 * s + 1.8 * s * g;
  return (netVo2 * weightKg * minutes * 5) / 1000;
}

/** Chiều dài bước ước tính theo chiều cao (m). */
export const strideM = (heightCm: number) => (heightCm * 0.415) / 100;

/**
 * kcal ròng từ số bước đi bộ thường ngày: ~0,5 kcal/kg/km
 * (tương đương ACSM đi bộ bằng phẳng sau khi trừ năng lượng nghỉ).
 */
export function stepsKcal(steps: number, weightKg: number, heightCm: number) {
  const km = (steps * strideM(heightCm)) / 1000;
  return 0.5 * weightKg * km;
}

export type ExerciseInput = {
  activity: string;
  minutes: number;
  level?: string | null;
  speed_kmh?: number | null;
  incline_pct?: number | null;
};

export function exerciseKcal(e: ExerciseInput, weightKg: number): number {
  const a = activityById(e.activity);
  if (!a || !e.minutes) return 0;
  if (a.kind === "treadmill" || a.kind === "outdoor") {
    if (!e.speed_kmh) return 0;
    return acsmKcal(e.speed_kmh, e.incline_pct ?? 0, weightKg, e.minutes);
  }
  const level = a.levels?.find((l) => l.id === e.level) ?? a.levels?.[1];
  return level ? metKcal(level.met, weightKg, e.minutes) : 0;
}

// ---------- Tổng kết ngày ----------

export type DaySummary = {
  intake: number;
  protein: number;
  carb: number;
  fat: number;
  baseline: number;     // BMR × hệ số sinh hoạt (gồm cả tiêu hóa thức ăn và sinh hoạt văn phòng)
  stepsKcal: number;
  exerciseKcal: number;
  tdee: number;
  deficit: number;      // > 0: thâm hụt, < 0: dư
};

export function summarizeDay(args: {
  bmr: number;
  activityFactor: number;
  weightKg: number;
  heightCm: number;
  foods: { kcal: number; protein: number; carb: number; fat: number }[];
  exercises: { kcal: number }[];
  steps: number | null;
}): DaySummary {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const intake = sum(args.foods.map((f) => Number(f.kcal)));
  const baseline = args.bmr * args.activityFactor;
  const sk = args.steps ? stepsKcal(args.steps, args.weightKg, args.heightCm) : 0;
  const ek = sum(args.exercises.map((e) => Number(e.kcal)));
  const tdee = baseline + sk + ek;
  return {
    intake,
    protein: sum(args.foods.map((f) => Number(f.protein))),
    carb: sum(args.foods.map((f) => Number(f.carb))),
    fat: sum(args.foods.map((f) => Number(f.fat))),
    baseline,
    stepsKcal: sk,
    exerciseKcal: ek,
    tdee,
    deficit: tdee - intake,
  };
}

/** Dinh dưỡng của một khẩu phần từ giá trị trên 100 g. */
export function portion(per100: { kcal: number; protein: number; carb: number; fat: number }, grams: number) {
  const k = grams / 100;
  return {
    kcal: per100.kcal * k,
    protein: per100.protein * k,
    carb: per100.carb * k,
    fat: per100.fat * k,
  };
}

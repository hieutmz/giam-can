import { addDays, daysBetween, parseISODate } from "./date";

export const KCAL_PER_KG = 7700;

export type WeightPoint = { date: string; kg: number };
export type TrendPoint = WeightPoint & { trend: number };

/**
 * Đường xu hướng cân nặng: trung bình trượt hàm mũ tính theo ngày, nên cân thưa vẫn đúng.
 * `span` ≈ số ngày làm mượt. `points` phải xếp tăng dần theo ngày.
 */
export function weightTrend(points: WeightPoint[], span = 10): TrendPoint[] {
  const daily = 2 / (span + 1);
  const out: TrendPoint[] = [];
  for (const p of points) {
    const prev = out.at(-1);
    if (!prev) {
      out.push({ ...p, trend: p.kg });
      continue;
    }
    const weight = 1 - (1 - daily) ** daysBetween(prev.date, p.date);
    out.push({ ...p, trend: prev.trend + weight * (p.kg - prev.trend) });
  }
  return out;
}

/** Độ dốc hồi quy tuyến tính (kg/ngày). Dùng số cân gốc nên không bị trễ như đường làm mượt. */
export function weightSlope(points: WeightPoint[]) {
  if (points.length < 2) return 0;
  const xs = points.map((p) => daysBetween(points[0].date, p.date));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = points.reduce((a, p) => a + p.kg, 0) / points.length;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (den === 0) return 0;
  return xs.reduce((a, x, i) => a + (x - mx) * (points[i].kg - my), 0) / den;
}

export type IntakeDay = { date: string; intake: number; formulaTdee: number };

export const ADAPTIVE = {
  windowDays: 28,
  minSpanDays: 14,
  minWeighIns: 8,
  minIntakeDays: 10,
  /** Ngày nạp dưới tỉ lệ này của BMR gần như chắc là ghi thiếu, không đưa vào trung bình */
  minIntakeRatio: 0.5,
};

export type AdaptiveTdee =
  | { ready: true; tdee: number; formulaTdee: number; intake: number; kgPerWeek: number; realDeficit: number; weighIns: number; intakeDays: number }
  | { ready: false; needWeighIns: number; needIntakeDays: number; needSpanDays: number };

/**
 * TDEE suy từ dữ liệu thật: năng lượng nạp trung bình cộng với phần cơ thể đã đốt từ mô dự trữ.
 * TDEE = kcal nạp TB − độ dốc cân (kg/ngày) × 7.700.
 */
export function adaptiveTdee(weights: WeightPoint[], days: IntakeDay[], bmr: number): AdaptiveTdee {
  const lastDate = weights.at(-1)?.date;
  const inWindow = lastDate ? weights.filter((w) => daysBetween(w.date, lastDate) < ADAPTIVE.windowDays) : [];
  const first = inWindow[0]?.date;
  const span = first && lastDate ? daysBetween(first, lastDate) : 0;
  const complete = first
    ? days.filter((d) => d.date >= first && d.date <= lastDate! && d.intake >= bmr * ADAPTIVE.minIntakeRatio)
    : [];

  const needWeighIns = Math.max(0, ADAPTIVE.minWeighIns - inWindow.length);
  const needIntakeDays = Math.max(0, ADAPTIVE.minIntakeDays - complete.length);
  const needSpanDays = Math.max(0, ADAPTIVE.minSpanDays - span);
  if (needWeighIns || needIntakeDays || needSpanDays) return { ready: false, needWeighIns, needIntakeDays, needSpanDays };

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const intake = avg(complete.map((d) => d.intake));
  const slope = weightSlope(inWindow);
  const realDeficit = -slope * KCAL_PER_KG;
  return {
    ready: true,
    tdee: intake + realDeficit,
    formulaTdee: avg(complete.map((d) => d.formulaTdee)),
    intake,
    kgPerWeek: slope * 7,
    realDeficit,
    weighIns: inWindow.length,
    intakeDays: complete.length,
  };
}

/** Thứ Hai của tuần chứa ngày này. */
export function weekStart(date: string) {
  const dow = parseISODate(date).getDay();
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export type DayFacts = {
  date: string;
  hasFood: boolean;
  intake: number;
  protein: number;
  /** null: ngày chưa được tính vào bộ đếm */
  deficit: number | null;
  gym: boolean;
  steps: number | null;
  water: number | null;
  sleep: number | null;
};

export type WeekTargets = { protein: number; steps?: number | null; water?: number | null; sleep?: number | null };

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const present = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);

/** Số ngày đạt mục tiêu; null khi chưa đặt mục tiêu. */
const hits = (xs: number[], target: number | null | undefined) => (target ? xs.filter((x) => x >= target).length : null);

export function weekSummary(args: { days: DayFacts[]; trend: TrendPoint[]; from: string; today: string; targets: WeekTargets }) {
  const { days, trend, from, today, targets } = args;
  const to = addDays(from, 6);
  const last = to < today ? to : today;
  const elapsed = Math.max(0, daysBetween(from, last) + 1);
  const week = days.filter((d) => d.date >= from && d.date <= last);

  const counted = present(week.map((d) => d.deficit));
  const foodDays = week.filter((d) => d.hasFood);
  // Ngày nhập từ nhật ký cũ chỉ có kcal, protein bằng 0 sẽ kéo sai trung bình
  const proteinDays = foodDays.map((d) => d.protein).filter((p) => p > 0);
  const steps = present(week.map((d) => d.steps));
  const water = present(week.map((d) => d.water));
  const sleep = present(week.map((d) => d.sleep));

  const inWeek = trend.filter((p) => p.date >= from && p.date <= to);
  const before = trend.filter((p) => p.date < from).at(-1);
  const end = inWeek.at(-1);
  const startPoint = before ?? inWeek[0];
  const weightChange = end && startPoint && end !== startPoint ? end.trend - startPoint.trend : null;

  return {
    from,
    to,
    elapsed,
    loggedDays: counted.length,
    missedDays: elapsed - counted.length,
    deficitTotal: counted.length ? counted.reduce((a, b) => a + b, 0) : null,
    deficitAvg: average(counted),
    intakeAvg: average(foodDays.map((d) => d.intake)),
    proteinAvg: average(proteinDays),
    proteinHit: hits(proteinDays, targets.protein),
    gymDays: week.filter((d) => d.gym).length,
    stepsAvg: average(steps),
    stepsHit: hits(steps, targets.steps),
    waterAvg: average(water),
    waterHit: hits(water, targets.water),
    sleepAvg: average(sleep),
    sleepHit: hits(sleep, targets.sleep),
    weightChange,
    weighIns: inWeek.length,
  };
}

export type WeekSummary = ReturnType<typeof weekSummary>;

type Measured = { measured_on: string };

/** Số mới nhất của một chỉ số và mức đổi so với lần đo đầu. `rows` xếp tăng dần theo ngày. */
export function metricChange<K extends string, T extends Measured & Record<K, number | null>>(rows: T[], key: K) {
  const values = rows.map((r) => r[key]).filter((v): v is T[K] & number => v != null).map(Number);
  if (values.length === 0) return null;
  const latest = values[values.length - 1];
  return { latest, fromFirst: values.length > 1 ? latest - values[0] : null };
}

/** Cơ xương giảm từ ngưỡng này giữa 2 lần đo là đáng lưu ý, nhỏ hơn thì nằm trong sai số của máy đo */
export const MUSCLE_LOSS_KG = 0.5;

/** Mức giảm cơ giữa 2 lần đo gần nhất nếu vượt ngưỡng, nếu không trả null. */
export function muscleLoss(rows: (Measured & { smm_kg: number | null })[]) {
  const values = rows.map((r) => r.smm_kg).filter((v): v is number => v != null).map(Number);
  if (values.length < 2) return null;
  const change = values[values.length - 1] - values[values.length - 2];
  return change <= -MUSCLE_LOSS_KG ? change : null;
}

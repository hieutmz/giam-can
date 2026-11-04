import { addDays, daysBetween, parseISODate } from "./date";
import type { DayRow } from "./days";
import { WEEK_PLAN, isLiftPlan } from "./lifts";
import { KCAL_PER_KG, type AdaptiveTdee, type TrendPoint } from "./progress";
import { progressPoints, sessionsOf } from "./strength";
import type { BodyMeasurement, StrengthSet } from "./types";

/** Thâm hụt mỗi ngày trên mức này là quá gắt, nên lùi mốc thay vì ép (theo kế hoạch đã thống nhất) */
export const MAX_SAFE_DEFICIT = 1000;
/** Mức thâm hụt gợi ý cho giai đoạn tiếp theo */
export const NEXT_DEFICIT = 500;

export type PlanStatus = "no_data" | "reached" | "on_track" | "behind";

type BodyKey = "bfm_kg" | "smm_kg" | "pbf" | "waist_cm" | "weight_kg";

/** Mốc đầu: lần đo gần nhất trước/đúng ngày bắt đầu (không có thì lần đầu tiên); mốc cuối: lần đo mới nhất tới hôm nay. */
export function bodyChange(rows: BodyMeasurement[], key: BodyKey, start: string, today: string) {
  const withValue = rows.filter((r) => r[key] != null && r.measured_on <= today);
  if (withValue.length === 0) return null;
  const base = withValue.filter((r) => r.measured_on <= start).at(-1) ?? withValue[0];
  const last = withValue.at(-1)!;
  const from = Number(base[key]);
  const to = Number(last[key]);
  return { from, to, change: base === last ? null : to - from, fromDate: base.measured_on, toDate: last.measured_on };
}

/** Mỗi bài có ít nhất 2 buổi trong kỳ: so 1RM (hoặc số lần) buổi đầu với buổi cuối. Lệch dưới 2% coi là giữ nguyên. */
export function liftTrend(sets: StrengthSet[], start: string, end: string) {
  const inPlan = sets.filter((s) => s.log_date >= start && s.log_date <= end);
  const out = { up: 0, flat: 0, down: 0 };
  for (const lift of new Set(inPlan.map((s) => s.lift))) {
    const pts = progressPoints(sessionsOf(inPlan, lift));
    if (pts.length < 2) continue;
    const change = (pts.at(-1)!.value - pts[0].value) / pts[0].value;
    if (change > 0.02) out.up++;
    else if (change < -0.02) out.down++;
    else out.flat++;
  }
  return out;
}

/** kcal/ngày cho giai đoạn sau: TDEE (thực tế nếu đủ dữ liệu, không thì theo công thức) − 500, làm tròn 50, không dưới BMR. */
export function nextKcal(tdee: number, bmr: number) {
  const round50 = (n: number) => Math.round(n / 50) * 50;
  return Math.max(Math.ceil(bmr / 50) * 50, round50(tdee - NEXT_DEFICIT));
}

export function planReview(args: {
  start: string;
  end: string;
  today: string;
  /** Các ngày từ `start`, có thể vượt quá `end` (sẽ bị cắt) */
  rows: DayRow[];
  trend: TrendPoint[];
  body: BodyMeasurement[];
  strength: StrengthSet[];
  targetKg: number | null;
  proteinTarget: number;
  adaptive: AdaptiveTdee;
  bmr: number;
}) {
  const { start, end, today } = args;
  const last = today < end ? today : end;
  const totalDays = daysBetween(start, end) + 1;
  const elapsed = Math.max(0, Math.min(totalDays, daysBetween(start, today) + 1));
  const daysLeft = Math.max(0, daysBetween(last, end));

  const rows = args.rows.filter((r) => r.date >= start && r.date <= last);
  const logged = rows.filter((r) => r.logged);
  const deficitTotal = logged.reduce((a, r) => a + r.deficit, 0);
  const avgDeficit = logged.length ? deficitTotal / logged.length : 0;
  const fatKg = deficitTotal / KCAL_PER_KG;
  const projectedKg = (deficitTotal + avgDeficit * daysLeft) / KCAL_PER_KG;
  const targetKg = args.targetKg && args.targetKg > 0 ? args.targetKg : null;
  const neededPerDay = targetKg && daysLeft > 0 ? Math.max(0, (targetKg * KCAL_PER_KG - deficitTotal) / daysLeft) : null;

  let status: PlanStatus = "no_data";
  if (logged.length && targetKg) status = fatKg >= targetKg ? "reached" : projectedKg >= targetKg ? "on_track" : "behind";

  const food = rows.filter((r) => r.hasFood);
  const proteinDays = food.map((r) => r.s.protein).filter((p) => p > 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const strengthDays = new Set(args.strength.filter((s) => s.log_date >= start && s.log_date <= last).map((s) => s.log_date));
  const gymDays = new Set([...rows.filter((r) => r.gym).map((r) => r.date), ...strengthDays]);
  let gymPlanned = 0;
  for (let d = start; d <= last; d = addDays(d, 1)) if (isLiftPlan(WEEK_PLAN[parseISODate(d).getDay()])) gymPlanned++;

  const trend = args.trend.filter((p) => p.date <= last);
  const trendStart = trend.filter((p) => p.date <= start).at(-1) ?? trend[0];
  const trendNow = trend.at(-1);

  const recent = logged.filter((r) => r.hasFood).slice(-14);
  const tdee = args.adaptive.ready ? args.adaptive.tdee : avg(recent.map((r) => r.s.tdee));

  return {
    start,
    end,
    totalDays,
    elapsed,
    daysLeft,
    finished: today > end,
    loggedDays: logged.length,
    deficitTotal,
    avgDeficit,
    fatKg,
    projectedKg,
    targetKg,
    neededPerDay,
    neededTooHigh: neededPerDay != null && neededPerDay > MAX_SAFE_DEFICIT,
    status,
    intakeAvg: avg(food.map((r) => r.s.intake)),
    proteinAvg: avg(proteinDays),
    proteinHit: proteinDays.filter((p) => p >= args.proteinTarget).length,
    proteinDays: proteinDays.length,
    gymDone: gymDays.size,
    gymPlanned,
    weight: trendStart && trendNow && trendStart !== trendNow ? { from: trendStart.trend, to: trendNow.trend, change: trendNow.trend - trendStart.trend } : null,
    bfm: bodyChange(args.body, "bfm_kg", start, last),
    smm: bodyChange(args.body, "smm_kg", start, last),
    pbf: bodyChange(args.body, "pbf", start, last),
    waist: bodyChange(args.body, "waist_cm", start, last),
    lifts: liftTrend(args.strength, start, last),
    next: tdee ? { tdee, kcal: nextKcal(tdee, args.bmr), basis: args.adaptive.ready ? ("real" as const) : ("formula" as const) } : null,
  };
}

export type PlanReview = ReturnType<typeof planReview>;

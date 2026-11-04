import type { getRange } from "./api";
import { dayDeficit, effectiveBmr, summarizeDay, type DaySummary } from "./calc";
import { addDays } from "./date";
import { activityById } from "./exercises";
import type { DayFacts } from "./progress";
import type { Profile } from "./types";

export type RangeData = Awaited<ReturnType<typeof getRange>>;

export type DayRow = {
  date: string;
  s: DaySummary;
  /** Đã nhập món ăn hoặc đã tự chốt thâm hụt: ngày được cộng vào bộ đếm */
  logged: boolean;
  hasFood: boolean;
  fixed: boolean;
  deficit: number;
  weight: number | null;
  /** Thâm hụt cộng dồn từ `start` tới hết ngày này */
  cumulative: number;
  gym: boolean;
  steps: number | null;
  water: number | null;
  sleep: number | null;
};

/** Tóm tắt từng ngày có dữ liệu trong [start, end], kèm bộ đếm thâm hụt cộng dồn. */
export function dayRows(data: RangeData, profile: Profile, start: string, end: string): DayRow[] {
  const bmr = effectiveBmr(profile);
  if (!bmr) return [];
  const out: DayRow[] = [];
  let cum = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const foods = data.foods.filter((f) => f.log_date === d);
    const exercises = data.exercises.filter((e) => e.log_date === d);
    const day = data.days.find((x) => x.log_date === d);
    const fixed = day?.deficit_override != null;
    const logged = foods.length > 0 || fixed;
    if (!logged && !day && !exercises.length) continue;
    const s = summarizeDay({
      bmr,
      activityFactor: Number(profile.activity_factor),
      weightKg: Number(day?.weight_kg ?? profile.weight_kg ?? 70),
      heightCm: Number(profile.height_cm ?? 165),
      foods,
      exercises,
      steps: day?.steps ?? null,
    });
    // Chỉ cộng vào bộ đếm những ngày đã nhập món ăn hoặc đã tự chốt số thâm hụt
    const deficit = dayDeficit(s, day?.deficit_override);
    if (logged) cum += deficit;
    out.push({
      date: d,
      s,
      logged,
      hasFood: foods.length > 0,
      fixed,
      deficit,
      weight: day?.weight_kg ?? null,
      cumulative: cum,
      gym: exercises.some((e) => activityById(e.activity)?.group === "gym"),
      steps: day?.steps ?? null,
      water: day?.water_ml ?? null,
      sleep: day?.sleep_hours == null ? null : Number(day.sleep_hours),
    });
  }
  return out;
}

export const toFacts = (rows: DayRow[]): DayFacts[] =>
  rows.map((r) => ({
    date: r.date,
    hasFood: r.hasFood,
    intake: r.s.intake,
    protein: r.s.protein,
    deficit: r.logged ? r.deficit : null,
    gym: r.gym,
    steps: r.steps,
    water: r.water,
    sleep: r.sleep,
  }));

export const weightPoints = (rows: DayRow[]) => rows.flatMap((r) => (r.weight == null ? [] : [{ date: r.date, kg: Number(r.weight) }]));

export const intakeDays = (rows: DayRow[]) => rows.filter((r) => r.hasFood).map((r) => ({ date: r.date, intake: r.s.intake, formulaTdee: r.s.tdee }));

/** Bộ đếm thâm hụt: tổng, trung bình mỗi ngày đã ghi, % mục tiêu và ngày dự kiến về đích theo tốc độ đó. */
export function counter(rows: DayRow[], goal: number, end: string) {
  const logged = rows.filter((r) => r.logged);
  const total = logged.at(-1)?.cumulative ?? 0;
  const avg = logged.length ? total / logged.length : 0;
  return {
    total,
    avg,
    loggedDays: logged.length,
    pct: Math.max(0, (total / goal) * 100),
    remaining: Math.max(0, goal - total),
    eta: avg > 0 ? addDays(end, Math.ceil((goal - total) / avg)) : null,
  };
}

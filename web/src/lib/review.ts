import type { DaySummary } from "./calc";
import { addDays } from "./date";
import { counter, type DayRow } from "./days";
import type { DayLog, DayReviewInput, DayReviewSnapshot, ExerciseLog, FoodLog, Profile, StrengthSet } from "./types";

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Gom set theo bài, vd "Squat tạ đòn: 60×8, 60×8, 60×7". */
function strengthLines(sets: StrengthSet[]) {
  const by = new Map<string, string[]>();
  for (const s of sets) by.set(s.name, [...(by.get(s.name) ?? []), s.weight_kg == null ? `×${s.reps}` : `${Number(s.weight_kg)}×${s.reps}`]);
  return [...by].map(([name, list]) => ({ name, sets: list.join(", ") }));
}

/**
 * Số liệu gửi cho AI tổng kết ngày. `rows` là các ngày từ start_date tới hết `date`
 * (để tính bộ đếm giống trang Thống kê); `exerciseNames` là tên bài đã dịch theo ngôn ngữ hiện tại.
 */
export function reviewInput(args: {
  date: string;
  lang: DayReviewInput["lang"];
  profile: Profile;
  bmr: number;
  s: DaySummary;
  day: DayLog | null;
  foods: FoodLog[];
  exercises: (ExerciseLog & { label: string })[];
  strength: StrengthSet[];
  rows: DayRow[];
  now?: Date;
}): DayReviewInput {
  const { date, profile: p, s, day } = args;
  const fixed = day?.deficit_override ?? null;
  const c = counter(args.rows, p.deficit_goal, date);
  const recent: DayReviewInput["recent"] = [];
  for (let d = addDays(date, -7); d < date; d = addDays(d, 1)) {
    const row = args.rows.find((r) => r.date === d);
    recent.push({ date: d, intake: row?.hasFood ? r0(row.s.intake) : null, deficit: row?.logged ? r0(row.deficit) : null });
  }
  return {
    date,
    lang: args.lang,
    profile: {
      sex: p.sex,
      age: p.birth_year ? (args.now ?? new Date()).getFullYear() - p.birth_year : null,
      height_cm: p.height_cm == null ? null : Number(p.height_cm),
      bmr: args.bmr,
      kcal_target: p.kcal_target,
      protein_target: p.protein_target,
      carb_target: p.carb_target,
      fat_target: p.fat_target,
      water_target_ml: p.water_target_ml,
      sleep_target: Number(p.sleep_target),
      steps_target: p.steps_target,
      health_note: p.health_note?.trim() || null,
    },
    day: {
      intake: r0(s.intake),
      protein: r1(s.protein),
      carb: r1(s.carb),
      fat: r1(s.fat),
      baseline: r0(s.baseline),
      steps: day?.steps ?? null,
      steps_kcal: r0(s.stepsKcal),
      exercise_kcal: r0(s.exerciseKcal),
      tdee: r0(s.tdee),
      deficit: r0(fixed ?? s.deficit),
      deficit_fixed: fixed != null,
      counted: args.foods.length > 0 || fixed != null,
      water_ml: day?.water_ml ?? null,
      sleep_hours: day?.sleep_hours == null ? null : Number(day.sleep_hours),
      weight_kg: day?.weight_kg == null ? null : Number(day.weight_kg),
      note: day?.note?.trim() || null,
    },
    foods: args.foods.map((f) => ({ meal: f.meal, name: f.name, kcal: r0(Number(f.kcal)), protein: r1(Number(f.protein)) })),
    exercises: args.exercises.map((e) => ({ name: e.label, minutes: Number(e.minutes), kcal: r0(Number(e.kcal)) })),
    strength: strengthLines(args.strength),
    counter: {
      goal: p.deficit_goal,
      total: r0(c.total),
      pct: r1(c.pct),
      remaining: r0(c.remaining),
      avg: r0(c.avg),
      eta: c.eta,
      logged_days: c.loggedDays,
    },
    recent,
  };
}

export const snapshotOf = (input: DayReviewInput): DayReviewSnapshot => ({
  intake: input.day.intake,
  tdee: input.day.tdee,
  deficit: input.day.deficit,
  counted: input.day.counted,
  counter: input.counter,
});

/** Nhật ký đã đổi sau lần đánh giá (lệch từ 1 kcal) thì nên đánh giá lại. */
export const isStale = (snap: DayReviewSnapshot, intake: number, tdee: number) =>
  Math.abs(snap.intake - Math.round(intake)) >= 1 || Math.abs(snap.tdee - Math.round(tdee)) >= 1;

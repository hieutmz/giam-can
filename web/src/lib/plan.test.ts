import { describe, expect, it } from "vitest";
import type { DaySummary } from "./calc";
import type { DayRow } from "./days";
import { bodyChange, liftTrend, nextKcal, planReview } from "./plan";
import type { AdaptiveTdee } from "./progress";
import type { BodyMeasurement, StrengthSet } from "./types";

const summary = (intake: number, tdee: number, protein = 140): DaySummary => ({
  intake,
  protein,
  carb: 0,
  fat: 0,
  baseline: tdee,
  stepsKcal: 0,
  exerciseKcal: 0,
  tdee,
  deficit: tdee - intake,
});

const row = (date: string, deficit: number, extra: Partial<DayRow> = {}): DayRow => ({
  date,
  s: summary(1800, 1800 + deficit),
  logged: true,
  hasFood: true,
  fixed: false,
  deficit,
  weight: null,
  cumulative: 0,
  gym: false,
  steps: null,
  water: null,
  sleep: null,
  ...extra,
});

const notReady: AdaptiveTdee = { ready: false, needWeighIns: 8, needIntakeDays: 0, needSpanDays: 0 };

const base = {
  start: "2026-10-12",
  end: "2026-11-21",
  trend: [],
  body: [],
  strength: [],
  proteinTarget: 140,
  adaptive: notReady,
  bmr: 1624,
};

describe("planReview", () => {
  it("đếm ngày đã qua / còn lại tính cả ngày đầu và ngày cuối", () => {
    const r = planReview({ ...base, today: "2026-11-04", rows: [], targetKg: 3 });
    expect(r.totalDays).toBe(41);
    expect(r.elapsed).toBe(24);
    expect(r.daysLeft).toBe(17);
    expect(r.status).toBe("no_data");
  });

  it("dự báo theo thâm hụt trung bình: 2 ngày × 770 kcal, còn 17 ngày → 2,1 kg; mục tiêu 3 kg là chậm", () => {
    const r = planReview({ ...base, today: "2026-11-04", rows: [row("2026-11-03", 770), row("2026-11-04", 770)], targetKg: 3 });
    expect(r.fatKg).toBeCloseTo(0.2);
    expect(r.projectedKg).toBeCloseTo(1.9);
    expect(r.status).toBe("behind");
    // (3 × 7.700 − 1.540) / 17
    expect(r.neededPerDay).toBeCloseTo(1268.2, 1);
    expect(r.neededTooHigh).toBe(true);
  });

  it("bỏ qua ngày ngoài kỳ kế hoạch", () => {
    const r = planReview({ ...base, end: "2026-10-13", today: "2026-11-04", rows: [row("2026-10-12", 500), row("2026-10-20", 9000)], targetKg: 1 });
    expect(r.deficitTotal).toBe(500);
    expect(r.finished).toBe(true);
    expect(r.daysLeft).toBe(0);
  });

  it("đã đủ thâm hụt thì là reached", () => {
    const r = planReview({ ...base, today: "2026-10-13", rows: [row("2026-10-12", 7700)], targetKg: 1 });
    expect(r.status).toBe("reached");
  });

  it("đếm buổi gym theo lịch (T2, T3, T5, T6) và buổi đã tập, gộp cả ngày chỉ ghi tập tạ", () => {
    const sets: StrengthSet[] = [{ id: "1", log_date: "2026-10-14", lift: "squat", name: "Squat", reps: 8, weight_kg: 60, created_at: "x" }];
    const r = planReview({ ...base, today: "2026-10-18", rows: [row("2026-10-12", 0, { gym: true })], strength: sets, targetKg: 3 });
    expect(r.gymPlanned).toBe(4);
    expect(r.gymDone).toBe(2);
  });
});

describe("bodyChange", () => {
  const m = (measured_on: string, bfm_kg: number | null): BodyMeasurement => ({
    id: measured_on,
    measured_on,
    weight_kg: null,
    pbf: null,
    bfm_kg,
    smm_kg: null,
    waist_cm: null,
    visceral_fat: null,
    note: null,
  });

  it("mốc đầu là lần đo gần nhất trước ngày bắt đầu", () => {
    const c = bodyChange([m("2026-10-01", 32), m("2026-10-05", 30.9), m("2026-11-01", 29.4)], "bfm_kg", "2026-10-12", "2026-11-04");
    expect(c?.from).toBe(30.9);
    expect(c?.change).toBeCloseTo(-1.5);
  });

  it("mới đo 1 lần thì chưa có mức thay đổi", () => {
    expect(bodyChange([m("2026-10-05", 30.9)], "bfm_kg", "2026-10-12", "2026-11-04")?.change).toBeNull();
  });
});

describe("liftTrend", () => {
  const s = (log_date: string, lift: string, weight_kg: number): StrengthSet => ({ id: log_date + lift, log_date, lift, name: lift, reps: 8, weight_kg, created_at: log_date });

  it("so buổi đầu với buổi cuối trong kỳ", () => {
    const sets = [s("2026-10-13", "squat", 60), s("2026-10-27", "squat", 65), s("2026-10-12", "bench_press", 40), s("2026-10-26", "bench_press", 40), s("2026-10-14", "rdl", 50)];
    expect(liftTrend(sets, "2026-10-12", "2026-11-04")).toEqual({ up: 1, flat: 1, down: 0 });
  });
});

describe("nextKcal", () => {
  it("TDEE − 500, làm tròn 50", () => {
    expect(nextKcal(2380, 1624)).toBe(1900);
  });
  it("không xuống dưới BMR", () => {
    expect(nextKcal(1900, 1624)).toBe(1650);
  });
});

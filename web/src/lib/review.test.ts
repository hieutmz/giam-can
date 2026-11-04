import { describe, expect, it } from "vitest";
import { summarizeDay } from "./calc";
import type { DayRow } from "./days";
import { isStale, reviewInput, snapshotOf } from "./review";
import type { FoodLog, Profile, StrengthSet } from "./types";

const profile: Profile = {
  id: "u",
  display_name: null,
  sex: "male",
  birth_year: 1999,
  height_cm: 166,
  weight_kg: 89,
  bmr_override: 1624,
  activity_factor: 1.2,
  kcal_target: 1800,
  protein_target: 140,
  carb_target: 186,
  fat_target: 55,
  water_target_ml: 2000,
  sleep_target: 7.5,
  steps_target: 6000,
  deficit_goal: 77000,
  start_date: "2026-10-12",
  plan_start: null,
  plan_end: null,
  fat_loss_target_kg: null,
  health_note: "  men gan cao ",
};

const food: FoodLog = { id: "f", log_date: "2026-11-04", meal: "trua", food_ref: null, name: "Cơm gà", grams: null, kcal: 650.4, protein: 30.26, carb: 80, fat: 20 };
const s = summarizeDay({ bmr: 1624, activityFactor: 1.2, weightKg: 89, heightCm: 166, foods: [food], exercises: [], steps: null });

const row = (date: string, deficit: number, cumulative: number): DayRow => ({
  date,
  s,
  logged: true,
  hasFood: true,
  fixed: false,
  deficit,
  weight: null,
  cumulative,
  gym: false,
  steps: null,
  water: null,
  sleep: null,
});

describe("reviewInput", () => {
  const sets: StrengthSet[] = [
    { id: "1", log_date: "2026-11-04", lift: "squat", name: "Squat tạ đòn", reps: 8, weight_kg: 60, created_at: "a" },
    { id: "2", log_date: "2026-11-04", lift: "squat", name: "Squat tạ đòn", reps: 7, weight_kg: 60, created_at: "b" },
    { id: "3", log_date: "2026-11-04", lift: "pushup", name: "Hít đất", reps: 15, weight_kg: null, created_at: "c" },
  ];
  const input = reviewInput({
    date: "2026-11-04",
    lang: "vi",
    profile,
    bmr: 1624,
    s,
    day: null,
    foods: [food],
    exercises: [],
    strength: sets,
    rows: [row("2026-11-02", 500, 500), row("2026-11-04", 1300, 1800)],
    now: new Date(2026, 10, 4),
  });

  it("làm tròn số, cắt khoảng trắng ghi chú sức khỏe, tính tuổi", () => {
    expect(input.day.intake).toBe(650);
    expect(input.foods[0].protein).toBe(30.3);
    expect(input.profile.health_note).toBe("men gan cao");
    expect(input.profile.age).toBe(27);
    expect(input.day.counted).toBe(true);
  });

  it("bộ đếm tính tới hết ngày đang xem", () => {
    expect(input.counter.total).toBe(1800);
    expect(input.counter.logged_days).toBe(2);
  });

  it("7 ngày trước đó, ngày không ghi là null", () => {
    expect(input.recent).toHaveLength(7);
    expect(input.recent.at(-1)).toEqual({ date: "2026-11-03", intake: null, deficit: null });
    expect(input.recent.at(-2)?.deficit).toBe(500);
  });

  it("gom set tập tạ theo bài", () => {
    expect(input.strength).toEqual([
      { name: "Squat tạ đòn", sets: "60×8, 60×7" },
      { name: "Hít đất", sets: "×15" },
    ]);
  });

  it("isStale khi kcal nạp đổi sau lần đánh giá", () => {
    const snap = snapshotOf(input);
    expect(isStale(snap, s.intake, s.tdee)).toBe(false);
    expect(isStale(snap, s.intake + 120, s.tdee)).toBe(true);
  });
});

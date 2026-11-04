import type { ExportData } from "./api";
import { dayDeficit, effectiveBmr, summarizeDay } from "./calc";

type Cell = string | number | null | undefined;

function csvCell(v: Cell) {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  // Excel coi ô mở đầu bằng các ký tự này là công thức
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV có BOM để Excel đọc đúng tiếng Việt. */
export function toCsv(headers: string[], rows: Cell[][]) {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function daysCsv({ profile, days, foods, exercises }: ExportData) {
  const dates = [...new Set([...days, ...foods, ...exercises].map((x) => x.log_date))].sort();
  const bmr = profile ? effectiveBmr(profile) : null;
  const rows = dates.map((date) => {
    const day = days.find((d) => d.log_date === date);
    const dayFoods = foods.filter((f) => f.log_date === date);
    const override = day?.deficit_override ?? null;
    const s =
      bmr && profile
        ? summarizeDay({
            bmr,
            activityFactor: Number(profile.activity_factor),
            weightKg: Number(day?.weight_kg ?? profile.weight_kg ?? 70),
            heightCm: Number(profile.height_cm ?? 165),
            foods: dayFoods,
            exercises: exercises.filter((e) => e.log_date === date),
            steps: day?.steps ?? null,
          })
        : null;
    const counted = dayFoods.length > 0 || override != null;
    return [
      date,
      s && r1(s.intake),
      s && r1(s.protein),
      s && r1(s.carb),
      s && r1(s.fat),
      s && r1(s.tdee),
      s && counted ? r1(dayDeficit(s, override)) : null,
      override != null ? 1 : 0,
      day?.steps,
      day?.water_ml,
      day?.sleep_hours,
      day?.weight_kg,
      day?.note,
    ];
  });
  return toCsv(
    ["date", "intake_kcal", "protein_g", "carb_g", "fat_g", "burn_kcal", "deficit_kcal", "deficit_fixed", "steps", "water_ml", "sleep_hours", "weight_kg", "note"],
    rows,
  );
}

export function foodsCsv({ foods }: ExportData) {
  return toCsv(
    ["date", "meal", "name", "grams", "kcal", "protein_g", "carb_g", "fat_g"],
    foods.map((f) => [f.log_date, f.meal, f.name, f.grams, f.kcal, f.protein, f.carb, f.fat]),
  );
}

export function exercisesCsv({ exercises }: ExportData) {
  return toCsv(
    ["date", "activity", "name", "minutes", "level", "speed_kmh", "incline_pct", "kcal"],
    exercises.map((e) => [e.log_date, e.activity, e.name, e.minutes, e.level, e.speed_kmh, e.incline_pct, e.kcal]),
  );
}

export function bodyCsv({ body }: ExportData) {
  return toCsv(
    ["date", "weight_kg", "pbf", "bfm_kg", "smm_kg", "waist_cm", "visceral_fat", "note"],
    body.map((b) => [b.measured_on, b.weight_kg, b.pbf, b.bfm_kg, b.smm_kg, b.waist_cm, b.visceral_fat, b.note]),
  );
}

export function strengthCsv({ strength }: ExportData) {
  return toCsv(
    ["date", "lift", "name", "reps", "weight_kg"],
    strength.map((s) => [s.log_date, s.lift, s.name, s.reps, s.weight_kg]),
  );
}

export function labsCsv({ labs }: ExportData) {
  return toCsv(
    ["date", "alt_u_l", "ast_u_l", "ggt_u_l", "note"],
    labs.map((l) => [l.measured_on, l.alt, l.ast, l.ggt, l.note]),
  );
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

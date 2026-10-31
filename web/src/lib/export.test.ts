import { describe, expect, it } from "vitest";
import type { ExportData } from "./api";
import { daysCsv, toCsv } from "./export";
import type { DayLog, FoodLog, Profile } from "./types";

const lines = (csv: string) => csv.replace("﻿", "").trimEnd().split("\r\n");

describe("toCsv", () => {
  it("mở đầu bằng BOM để Excel đọc đúng tiếng Việt", () => {
    expect(toCsv(["a"], []).charCodeAt(0)).toBe(0xfeff);
  });

  it("bọc ô có dấu phẩy, ngoặc kép, xuống dòng", () => {
    expect(lines(toCsv(["a", "b"], [['Cơm, canh "ngon"', "x\ny"]]))[1]).toBe('"Cơm, canh ""ngon""","x\ny"');
  });

  it("chặn chuỗi bị Excel hiểu là công thức, nhưng giữ số âm", () => {
    expect(lines(toCsv(["a", "b"], [["=1+1", -275]]))[1]).toBe("'=1+1,-275");
  });

  it("ô trống cho null và undefined, giữ số 0", () => {
    expect(lines(toCsv(["a", "b", "c"], [[null, undefined, 0]]))[1]).toBe(",,0");
  });
});

describe("daysCsv", () => {
  const profile = { sex: "male", birth_year: 1999, height_cm: 166, weight_kg: 89, bmr_override: 1624, activity_factor: 1.2 } as Profile;
  const day = (log_date: string, deficit_override: number | null) => ({ log_date, deficit_override, steps: null, weight_kg: null }) as DayLog;
  const food = (log_date: string, kcal: number) => ({ log_date, kcal, protein: 0, carb: 0, fat: 0 }) as FoodLog;
  const data = (d: Partial<ExportData>) => ({ profile, days: [], foods: [], exercises: [], custom_foods: [], favorites: [], ...d });
  const cell = (row: string, i: number) => row.split(",")[i];

  it("ngày có món dùng thâm hụt theo công thức", () => {
    const row = lines(daysCsv(data({ foods: [food("2026-10-20", 1800)] })))[1];
    expect(Number(cell(row, 6))).toBeCloseTo(1624 * 1.2 - 1800, 0);
    expect(cell(row, 7)).toBe("0");
  });

  it("ngày ấn định dùng số đã chốt, kể cả khi bằng 0 và chưa có món", () => {
    const row = lines(daysCsv(data({ days: [day("2026-10-17", 0)] })))[1];
    expect(cell(row, 6)).toBe("0");
    expect(cell(row, 7)).toBe("1");
  });

  it("ngày chưa có món và chưa ấn định thì để trống thâm hụt", () => {
    const row = lines(daysCsv(data({ days: [day("2026-10-23", null)] })))[1];
    expect(cell(row, 6)).toBe("");
  });

  it("gộp ngày từ mọi bảng và xếp tăng dần", () => {
    const out = lines(daysCsv(data({ days: [day("2026-10-20", null)], foods: [food("2026-10-19", 100)] })));
    expect(out.slice(1).map((r) => cell(r, 0))).toEqual(["2026-10-19", "2026-10-20"]);
  });
});

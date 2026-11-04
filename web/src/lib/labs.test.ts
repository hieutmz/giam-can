import { describe, expect, it } from "vitest";
import { labChange, labLimit, nearestBody, overLimit } from "./labs";
import type { BodyMeasurement, LabResult } from "./types";

const lab = (measured_on: string, alt: number | null, ggt: number | null = null): LabResult => ({ id: measured_on, measured_on, alt, ast: null, ggt, note: null });
const body = (measured_on: string): BodyMeasurement => ({
  id: measured_on,
  measured_on,
  weight_kg: 88,
  pbf: null,
  bfm_kg: 30,
  smm_kg: null,
  waist_cm: null,
  visceral_fat: null,
  note: null,
});

describe("labLimit / overLimit", () => {
  it("ngưỡng theo giới tính", () => {
    expect(labLimit("alt", "male")).toBe(40);
    expect(labLimit("ggt", "female")).toBe(40);
  });
  it("gấp bao nhiêu lần ngưỡng, dưới ngưỡng thì null", () => {
    expect(overLimit(72, 40)).toBe(1.8);
    expect(overLimit(40, 40)).toBeNull();
    expect(overLimit(null, 40)).toBeNull();
  });
});

describe("nearestBody", () => {
  it("chọn lần đo gần nhất trong 14 ngày, trước hay sau đều được", () => {
    const rows = [body("2026-10-05"), body("2026-11-01"), body("2026-11-20")];
    expect(nearestBody(rows, "2026-11-10")?.measured_on).toBe("2026-11-01");
    expect(nearestBody(rows, "2026-11-17")?.measured_on).toBe("2026-11-20");
  });
  it("quá 14 ngày thì không ghép", () => {
    expect(nearestBody([body("2026-10-05")], "2026-11-10")).toBeNull();
  });
});

describe("labChange", () => {
  it("so lần đầu với lần mới nhất có số", () => {
    const c = labChange([lab("2026-09-01", 80), lab("2026-10-01", null, 90), lab("2026-11-01", 60)], "alt");
    expect(c?.first.value).toBe(80);
    expect(c?.last.value).toBe(60);
    expect(c?.pct).toBe(-25);
  });
  it("chưa đủ 2 lần thì null", () => {
    expect(labChange([lab("2026-09-01", 80)], "alt")).toBeNull();
  });
});

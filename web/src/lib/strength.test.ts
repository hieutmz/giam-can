import { describe, expect, it } from "vitest";
import { liftById } from "./lifts";
import { e1rm, lastBefore, progressPoints, sessionStats, sessionsOf, strengthDrop, suggestNext } from "./strength";
import type { StrengthSet } from "./types";

let seq = 0;
const set = (log_date: string, weight_kg: number | null, reps: number, lift = "bench_press"): StrengthSet => ({
  id: String(++seq),
  log_date,
  lift,
  name: lift,
  reps,
  weight_kg,
  created_at: `2026-11-01T10:00:${String(seq).padStart(2, "0")}Z`,
});

describe("e1rm", () => {
  it("theo Epley: 60 kg × 10 ≈ 80 kg", () => {
    expect(e1rm(60, 10)).toBe(80);
  });
  it("không tính khi không có tạ", () => {
    expect(e1rm(null, 12)).toBeNull();
    expect(e1rm(0, 12)).toBeNull();
  });
});

describe("sessionsOf", () => {
  it("gom theo ngày, cũ trước, bỏ bài khác", () => {
    const s = sessionsOf([set("2026-11-03", 40, 8), set("2026-10-31", 40, 10), set("2026-11-03", 40, 7), set("2026-11-03", 20, 12, "squat")], "bench_press");
    expect(s.map((x) => x.date)).toEqual(["2026-10-31", "2026-11-03"]);
    expect(s[1].sets.map((x) => x.reps)).toEqual([8, 7]);
  });

  it("lastBefore bỏ qua chính ngày đang xem", () => {
    const s = sessionsOf([set("2026-10-31", 40, 10), set("2026-11-03", 40, 8)], "bench_press");
    expect(lastBefore(s, "2026-11-03")?.date).toBe("2026-10-31");
    expect(lastBefore(s, "2026-10-31")).toBeNull();
  });
});

describe("sessionStats", () => {
  it("tạ nặng nhất, tổng khối lượng, 1RM tốt nhất", () => {
    const [s] = sessionsOf([set("2026-11-03", 40, 10), set("2026-11-03", 45, 6)], "bench_press");
    expect(sessionStats(s)).toEqual({ topWeight: 45, bestReps: 10, volume: 670, best1rm: 54 });
  });
});

describe("suggestNext", () => {
  const bench = liftById("bench_press"); // 6–10 lần, +2,5 kg

  it("mọi set nặng nhất đủ 10 lần → tăng tạ, về 6 lần", () => {
    const [s] = sessionsOf([set("2026-11-03", 40, 10), set("2026-11-03", 40, 10), set("2026-11-03", 40, 10)], "bench_press");
    expect(suggestNext(bench, s)).toEqual({ weight: 42.5, reps: 6, kind: "up" });
  });

  it("chưa đủ → giữ tạ, thêm 1 lần ở set yếu nhất", () => {
    const [s] = sessionsOf([set("2026-11-03", 40, 10), set("2026-11-03", 40, 8), set("2026-11-03", 40, 7)], "bench_press");
    expect(suggestNext(bench, s)).toEqual({ weight: 40, reps: 8, kind: "reps" });
  });

  it("chỉ xét các set ở mức tạ nặng nhất (bỏ set khởi động)", () => {
    const [s] = sessionsOf([set("2026-11-03", 20, 5), set("2026-11-03", 40, 10), set("2026-11-03", 40, 10)], "bench_press");
    expect(suggestNext(bench, s)?.kind).toBe("up");
  });

  it("bài trọng lượng cơ thể: thêm 1 lần", () => {
    const [s] = sessionsOf([set("2026-11-03", null, 12, "pushup"), set("2026-11-03", null, 10, "pushup")], "pushup");
    expect(suggestNext(liftById("pushup"), s)).toEqual({ weight: null, reps: 13, kind: "reps" });
  });

  it("chưa có buổi nào thì không gợi ý", () => {
    expect(suggestNext(bench, null)).toBeNull();
  });
});

describe("strengthDrop", () => {
  const sessionsWith = (oneRm: number[]) =>
    sessionsOf(
      oneRm.map((w, i) => set(`2026-10-${String(10 + i).padStart(2, "0")}`, w, 0)),
      "bench_press",
    );

  it("2 buổi gần nhất đều thấp hơn đỉnh ≥ 10% → cảnh báo", () => {
    expect(strengthDrop(sessionsWith([50, 52, 51, 45, 44]))).toBe(15);
  });

  it("chỉ 1 buổi kém thì chưa cảnh báo", () => {
    expect(strengthDrop(sessionsWith([50, 52, 51, 52, 44]))).toBeNull();
  });

  it("cần ít nhất 3 buổi", () => {
    expect(strengthDrop(sessionsWith([50, 40]))).toBeNull();
  });

  it("progressPoints dùng số lần khi không có tạ", () => {
    const s = sessionsOf([set("2026-11-03", null, 15, "pushup")], "pushup");
    expect(progressPoints(s)).toEqual([{ date: "2026-11-03", value: 15 }]);
  });
});

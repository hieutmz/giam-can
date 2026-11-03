import type { Lift } from "./lifts";
import type { StrengthSet } from "./types";

export type Session = { date: string; sets: StrengthSet[] };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** 1RM ước tính theo công thức Epley; tập với trọng lượng cơ thể thì không tính. */
export const e1rm = (weight: number | null, reps: number) => (weight == null || Number(weight) <= 0 ? null : r1(Number(weight) * (1 + reps / 30)));

/** Các buổi tập của một bài, cũ trước; set trong buổi giữ đúng thứ tự đã ghi. */
export function sessionsOf(sets: StrengthSet[], lift: string): Session[] {
  const mine = sets
    .filter((s) => s.lift === lift)
    .sort((a, b) => a.log_date.localeCompare(b.log_date) || a.created_at.localeCompare(b.created_at));
  const out: Session[] = [];
  for (const s of mine) {
    const last = out.at(-1);
    if (last?.date === s.log_date) last.sets.push(s);
    else out.push({ date: s.log_date, sets: [s] });
  }
  return out;
}

/** Buổi gần nhất trước ngày `date` (không tính chính ngày đó). */
export const lastBefore = (sessions: Session[], date: string) => [...sessions].reverse().find((s) => s.date < date) ?? null;

export function sessionStats(s: Session) {
  const weights = s.sets.map((x) => (x.weight_kg == null ? null : Number(x.weight_kg))).filter((w): w is number => w != null && w > 0);
  const best = s.sets.map((x) => e1rm(x.weight_kg, x.reps)).filter((n): n is number => n != null);
  return {
    topWeight: weights.length ? Math.max(...weights) : null,
    bestReps: Math.max(...s.sets.map((x) => x.reps)),
    volume: r1(s.sets.reduce((a, x) => a + Number(x.weight_kg ?? 0) * x.reps, 0)),
    best1rm: best.length ? Math.max(...best) : null,
  };
}

export type Suggestion = { weight: number | null; reps: number; kind: "up" | "reps" };

/**
 * Double progression: mọi set ở mức tạ nặng nhất đã đạt số lần tối đa → tăng tạ và quay về số lần tối thiểu;
 * chưa đạt → giữ tạ, cố thêm 1 lần ở set yếu nhất. Bài trọng lượng cơ thể: thêm 1 lần so với set tốt nhất.
 */
export function suggestNext(lift: Lift, last: Session | null): Suggestion | null {
  if (!last?.sets.length) return null;
  const [lo, hi] = lift.reps;
  const { topWeight, bestReps } = sessionStats(last);
  if (lift.bodyweight || topWeight == null) return { weight: null, reps: bestReps + 1, kind: "reps" };
  const work = last.sets.filter((s) => Number(s.weight_kg) === topWeight);
  if (work.every((s) => s.reps >= hi)) return { weight: r1(topWeight + lift.step), reps: lo, kind: "up" };
  const weakest = Math.min(...work.map((s) => s.reps));
  return { weight: topWeight, reps: Math.min(hi, Math.max(lo, weakest + 1)), kind: "reps" };
}

/** Điểm vẽ tiến độ: 1RM ước tính tốt nhất mỗi buổi, hoặc số lần tốt nhất nếu không có tạ. */
export function progressPoints(sessions: Session[]) {
  return sessions.map((s) => {
    const st = sessionStats(s);
    return { date: s.date, value: st.best1rm ?? st.bestReps };
  });
}

/**
 * Sức mạnh giảm kéo dài: 2 buổi gần nhất đều thấp hơn buổi tốt nhất trong `window` buổi trước đó
 * ít nhất `threshold`. Trả về % giảm của buổi gần nhất, hoặc null.
 */
export function strengthDrop(sessions: Session[], window = 4, threshold = 0.1): number | null {
  const values = progressPoints(sessions).map((p) => p.value);
  if (values.length < 3) return null;
  const recent = values.slice(-2);
  const before = values.slice(-2 - window, -2);
  const best = Math.max(...before);
  if (best <= 0 || recent.some((v) => v > best * (1 - threshold))) return null;
  return Math.round(((best - recent[1]) / best) * 100);
}

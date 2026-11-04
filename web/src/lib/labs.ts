import { daysBetween } from "./date";
import type { BodyMeasurement, LabResult } from "./types";

export type LabKey = "alt" | "ast" | "ggt";
export const LAB_KEYS: LabKey[] = ["alt", "ast", "ggt"];

/**
 * Ngưỡng trên tham khảo (U/L) hay gặp ở phòng xét nghiệm Việt Nam. Mỗi nơi một ngưỡng,
 * nên chỉ dùng để tô màu; ngưỡng đúng là ngưỡng in trên phiếu kết quả.
 */
export function labLimit(key: LabKey, sex: "male" | "female") {
  if (key === "ggt") return sex === "male" ? 60 : 40;
  return sex === "male" ? 40 : 35;
}

/** Số lần vượt ngưỡng trên, vd 1,8 nghĩa là gấp 1,8 lần. Dưới ngưỡng trả về null. */
export function overLimit(value: number | null, limit: number) {
  if (value == null || value <= limit) return null;
  return Math.round((value / limit) * 10) / 10;
}

/** Lần đo cơ thể gần ngày xét nghiệm nhất, trong vòng `maxDays` ngày (trước hoặc sau). */
export function nearestBody(rows: BodyMeasurement[], date: string, maxDays = 14) {
  let best: BodyMeasurement | null = null;
  let bestGap = Infinity;
  for (const r of rows) {
    const gap = Math.abs(daysBetween(r.measured_on, date));
    if (gap <= maxDays && gap < bestGap) {
      best = r;
      bestGap = gap;
    }
  }
  return best;
}

/** So lần xét nghiệm đầu và mới nhất của một chỉ số: % thay đổi. Cần ít nhất 2 lần có số. */
export function labChange(rows: LabResult[], key: LabKey) {
  const values = rows.filter((r) => r[key] != null).map((r) => ({ date: r.measured_on, value: Number(r[key]) }));
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  return { first, last, pct: first.value ? Math.round(((last.value - first.value) / first.value) * 100) : null };
}

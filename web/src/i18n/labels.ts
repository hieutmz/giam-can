import { fmt } from "../lib/date";
import { activityById } from "../lib/exercises";
import type { ExerciseLog } from "../lib/types";
import type { usePrefs } from ".";

type P = Pick<ReturnType<typeof usePrefs>, "t" | "tx">;

/** Tên nhóm thực phẩm theo ngôn ngữ hiện tại (dữ liệu gốc là tiếng Việt). */
export const groupLabel = (p: P, group: string) => p.tx(`grp.${group}`, group);

/** Tên môn tập theo ngôn ngữ hiện tại. */
export const activityLabel = (p: P, id: string, fallback = id) => p.tx(`act.${id}`, fallback);

/** Tên bài tập đã ghi (môn + chi tiết) theo ngôn ngữ hiện tại; tên lưu trong DB chỉ dùng khi không nhận ra môn. */
export function exerciseLabel(p: P, e: Pick<ExerciseLog, "activity" | "name" | "level" | "speed_kmh" | "incline_pct">) {
  const a = activityById(e.activity);
  if (!a) return e.name;
  const name = activityLabel(p, a.id, a.name);
  if (e.speed_kmh != null) {
    return `${name} (${p.t("ex.detailWalk", { speed: fmt(Number(e.speed_kmh), 1), incline: fmt(Number(e.incline_pct ?? 0), 1) })})`;
  }
  if (e.level) {
    const level = p.tx(`level.${e.level}`, e.level).toLocaleLowerCase();
    return `${name} (${p.t("ex.detailLevel", { level })})`;
  }
  return name;
}

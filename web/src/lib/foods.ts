import { fmt } from "./date";
import type { Food, FoodLog } from "./types";

// Gộp tất cả file src/data/foods/*.json lúc build
const parts = import.meta.glob<{ default: Food[] }>("../data/foods/*.json", { eager: true });

export const FOODS: Food[] = Object.values(parts)
  .flatMap((m) => m.default)
  .sort((a, b) => a.name.localeCompare(b.name, "vi"));

export const FOOD_GROUPS: string[] = [...new Set(FOODS.map((f) => f.group))];

/** Đơn vị mà giá trị dinh dưỡng của món đang tính theo, vd "100 g" hoặc "1 ổ". */
export const unitLabel = (f: Pick<Food, "basis" | "serving_name">, servingWord = "phần") =>
  f.basis === "serving" ? `1 ${f.serving_name || servingWord}` : "100 g";

/** Tên món ghi vào nhật ký khi tính theo phần, vd "Bánh mì (1,5 ổ)". */
export const servingLabel = (name: string, amount: number, unit: string) => `${name} (${fmt(amount, 2)} ${unit})`;

export type RecentLog = Pick<FoodLog, "food_ref" | "name" | "grams" | "kcal" | "protein" | "carb" | "fat">;

/** Lượng đã ghi: số gram, hoặc số phần suy ra từ kcal (DB không lưu số phần). */
export function loggedAmount(log: Pick<FoodLog, "grams" | "kcal">, food: Pick<Food, "kcal" | "basis">) {
  if (food.basis !== "serving") return Number(log.grams) || 100;
  return Number(food.kcal) > 0 ? Math.round((Number(log.kcal) / Number(food.kcal)) * 100) / 100 : 1;
}

/** Bỏ lần ghi trùng món, giữ lần mới nhất. `logs` phải xếp mới nhất trước. */
export function uniqueRecent<T extends Pick<FoodLog, "food_ref" | "name">>(logs: T[], limit = 12): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const l of logs) {
    const key = l.food_ref ?? normalize(l.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
    if (out.length === limit) break;
  }
  return out;
}

/** Bỏ dấu tiếng Việt + chữ thường để tìm kiếm không cần gõ dấu. */
export function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

const INDEX = new Map<string, string>();
const keyOf = (f: { id: string; name: string }) => {
  let k = INDEX.get(f.id);
  if (k === undefined) {
    k = normalize(f.name);
    INDEX.set(f.id, k);
  }
  return k;
};

/** Tìm theo mọi từ khóa (không phân biệt dấu); ưu tiên tên bắt đầu bằng từ khóa. */
export function searchFoods<T extends { id: string; name: string }>(list: T[], query: string, limit = 50): T[] {
  const q = normalize(query);
  if (!q) return list.slice(0, limit);
  const words = q.split(/\s+/);
  const scored: { f: T; score: number }[] = [];
  for (const f of list) {
    const k = keyOf(f);
    if (!words.every((w) => k.includes(w))) continue;
    let score = 0;
    if (k.startsWith(q)) score += 100;
    else if (k.includes(q)) score += 50;
    if (k.startsWith(words[0])) score += 20;
    score -= k.length / 10;
    scored.push({ f, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.f);
}

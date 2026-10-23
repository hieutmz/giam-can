import type { Food } from "./types";

// Gộp tất cả file src/data/foods/*.json lúc build
const parts = import.meta.glob<{ default: Food[] }>("../data/foods/*.json", { eager: true });

export const FOODS: Food[] = Object.values(parts)
  .flatMap((m) => m.default)
  .sort((a, b) => a.name.localeCompare(b.name, "vi"));

export const FOOD_GROUPS: string[] = [...new Set(FOODS.map((f) => f.group))];

/** Đơn vị mà giá trị dinh dưỡng của món đang tính theo, vd "100 g" hoặc "1 ổ". */
export const unitLabel = (f: Pick<Food, "basis" | "serving_name">) =>
  f.basis === "serving" ? `1 ${f.serving_name || "phần"}` : "100 g";

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

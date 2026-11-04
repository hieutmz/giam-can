// Vercel Function: POST /api/suggest-meal
// Gợi ý 2–3 phương án món ăn cho bữa tiếp theo để bù protein còn thiếu mà không vượt kcal còn lại.
import type { Meal, SuggestItem, SuggestOption, SuggestRequest, SuggestResponse } from "../src/lib/types";
import { askJson, clean, fail, guard, json, str } from "./_shared.js";

const MEALS: Meal[] = ["sang", "trua", "xe", "toi", "phu"];
const MEAL_NAME: Record<Meal, string> = { sang: "bữa sáng", trua: "bữa trưa", xe: "bữa xế", toi: "bữa tối", phu: "bữa phụ / ăn khuya" };
const LANGUAGE = { vi: "tiếng Việt", en: "English", zh: "简体中文" } as const;
const MAX_BODY = 60_000;

const SYSTEM = `Bạn là chuyên gia dinh dưỡng 20 năm kinh nghiệm, rành món ăn Việt Nam, đang giúp một người giảm mỡ mà vẫn giữ cơ.
Bạn nhận phần kcal và macro CÒN LẠI trong ngày, các món đã ăn, ghi chú sức khỏe và danh sách "Món của tôi". Hãy gợi ý đúng 3 phương án cho bữa được hỏi.

Quy tắc:
- Ưu tiên bù protein còn thiếu. Tổng kcal mỗi phương án không vượt kcal còn lại (lệch tối đa +50 kcal). Nếu kcal còn lại rất ít hoặc âm, chọn món giàu đạm ít năng lượng nhất (ức gà, trứng trắng, sữa chua Hy Lạp không đường, cá hấp, đậu hũ, sữa tươi không đường…) và nói rõ trong "note".
- Nếu protein đã đủ, ưu tiên rau, chất xơ, món no lâu ít kcal.
- 3 phương án khác nhau về cách kiếm món: "where" là một trong: tự nấu nhanh ở nhà, cửa hàng tiện lợi / siêu thị, quán ăn bình dân. Món phải dễ mua ở Việt Nam, khẩu phần cụ thể (gram, hộp, quả, chén).
- Dùng "Món của tôi" nếu hợp, lấy đúng số liệu đã lưu.
- Tránh lặp món đã ăn trong ngày nếu có lựa chọn khác tương đương.
- Theo ghi chú sức khỏe (vd men gan cao: không rượu bia, hạn chế đồ ngọt, đồ chiên, mỡ động vật).
- Mỗi món: "name" kèm lượng, vd "Ức gà luộc (150 g)"; "grams" là khối lượng (0 nếu không rõ); kcal, protein, carb, fat cho đúng lượng đó.
- "title": tên ngắn của phương án; "note": 1 câu lý do hoặc mẹo (có thể để "").
- Không khuyên dùng thuốc, thực phẩm chức năng.`;

const num = { type: "number" } as const;
const SCHEMA = {
  type: "object",
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          where: { type: "string" },
          note: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, grams: num, kcal: num, protein: num, carb: num, fat: num },
              required: ["name", "grams", "kcal", "protein", "carb", "fat"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "where", "note", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["options"],
  additionalProperties: false,
};

const signed = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v) : 0;
};

export async function POST(request: Request) {
  const g = await guard<SuggestRequest>(request);
  if ("error" in g) return g.error;
  const b = g.body;
  if (!b?.remaining || !MEALS.includes(b.meal) || JSON.stringify(b).length > MAX_BODY) return fail("bad_request", 400);

  const r = b.remaining;
  const myFoods = (Array.isArray(b.myFoods) ? b.myFoods : []).slice(0, 100).map((f) => {
    const unit = f.basis === "serving" ? `1 ${str(f.serving_name) || "phần"}` : "100 g";
    return `- ${str(f.name).slice(0, 80)} | ${unit}: ${clean(f.kcal, 9999)} kcal, P ${clean(f.protein, 999)} g`;
  });
  const eaten = (Array.isArray(b.eaten) ? b.eaten : []).map(str).filter(Boolean).slice(0, 40);

  const prompt = [
    `Viết bằng ${LANGUAGE[b.lang] ?? LANGUAGE.vi}.`,
    `Gợi ý cho: ${MEAL_NAME[b.meal]}.`,
    `Còn lại trong ngày: ${signed(r.kcal)} kcal, protein ${signed(r.protein)} g, carb ${signed(r.carb)} g, fat ${signed(r.fat)} g (số âm là đã vượt).`,
    `Đã ăn hôm nay: ${eaten.length ? eaten.join("; ") : "chưa ghi món nào"}.`,
    `Ghi chú sức khỏe: ${str(b.health_note) || "không có"}.`,
    `Món của tôi:\n${myFoods.length ? myFoods.join("\n") : "(trống)"}`,
  ].join("\n");

  const res = await askJson<{ options: (Omit<SuggestOption, "items"> & { items: Record<string, unknown>[] })[] }>(g.apiKey, {
    system: SYSTEM,
    user: prompt,
    schema: SCHEMA,
    effort: "low",
  });
  if ("error" in res) return res.error;

  const options: SuggestOption[] = (res.data.options ?? []).slice(0, 3).map((o) => ({
    title: str(o.title).slice(0, 120),
    where: str(o.where).slice(0, 80),
    note: str(o.note).slice(0, 300),
    items: (o.items ?? []).slice(0, 8).map(
      (it): SuggestItem => ({
        name: str(it.name).slice(0, 120) || "?",
        grams: clean(it.grams, 3000) || null,
        kcal: clean(it.kcal, 3000),
        protein: clean(it.protein, 300),
        carb: clean(it.carb, 500),
        fat: clean(it.fat, 300),
      }),
    ),
  }));
  return json({ options } satisfies SuggestResponse);
}

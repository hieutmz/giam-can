// Vercel Function: POST /api/review-day
// "Tổng kết và đánh giá" cuối ngày: trình duyệt gửi số liệu đã tính sẵn, Claude nhận xét và gợi ý cho ngày mai.
import type { DayReviewInput, DayReviewText, ReviewArea, ReviewStatus } from "../src/lib/types";
import { askJson, fail, guard, json, str } from "./_shared.js";

const AREAS: ReviewArea[] = ["kcal", "protein", "water", "sleep", "activity", "food"];
const STATUSES: ReviewStatus[] = ["good", "warn", "bad"];
const MAX_BODY = 60_000;
const LANGUAGE = { vi: "tiếng Việt", en: "English", zh: "简体中文" } as const;

const SYSTEM = `Bạn là chuyên gia dinh dưỡng 20 năm kinh nghiệm, đang theo dõi một người giảm mỡ. Mỗi tối họ nhờ bạn "Tổng kết và đánh giá" ngày hôm đó.
Bạn nhận một JSON số liệu trong ngày đã được ứng dụng tính sẵn: kcal nạp, macro, danh sách món, bài tập, bước chân, nước, giấc ngủ, thâm hụt, bộ đếm thâm hụt tích lũy, mục tiêu và ghi chú sức khỏe.

Quy tắc:
- Dùng đúng các con số trong JSON, không tự tính lại kcal, thâm hụt hay bộ đếm. Khi nhắc số thì làm tròn và viết theo kiểu người dùng đọc (vd "1.850 kcal", "128 g").
- "items": đúng 6 mục theo thứ tự kcal, protein, water, sleep, activity, food. Mỗi mục 1–2 câu ngắn, có so với mục tiêu.
  - kcal: kcal nạp so với mục tiêu và thâm hụt trong ngày. Thâm hụt 300–1.000 kcal là tốt; dư (âm) là bad; thâm hụt trên 1.000 kcal kéo dài dễ mất cơ, là warn.
  - protein: so với protein_target; dưới 80% mục tiêu là bad.
  - water, sleep: so với mục tiêu; null nghĩa là chưa ghi, khi đó status "warn" và nhắc ghi, không đoán số.
  - activity: bước chân (steps; đã tính vào tiêu hao) và các buổi tập, kể cả tập tạ (strength) nếu có.
  - food: chất lượng món ăn, nhất là theo ghi chú sức khỏe (vd men gan cao: rượu bia, đồ ngọt, nước ngọt, đồ chiên, mỡ động vật). Khen món tốt cụ thể.
- status: "good" đạt, "warn" gần đạt hoặc thiếu dữ liệu, "bad" lệch nhiều.
- "headline": 1 câu tóm tắt cả ngày.
- "tomorrow": 2–4 việc cụ thể làm được ngay ngày mai, ưu tiên món ăn Việt dễ mua (vd "thêm 1 hộp sữa chua không đường và 2 quả trứng luộc vào bữa xế để đủ protein").
- Ngày chưa ghi món nào (counted = false, foods rỗng): nói rõ là chưa thể đánh giá kcal, vẫn nhận xét các mục khác.
- Không khuyên dùng thuốc hay thực phẩm chức năng để chữa bệnh; vấn đề sức khỏe thì khuyên hỏi bác sĩ.
- Giọng thân thiện, thẳng thắn, ngắn gọn.`;

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          area: { type: "string", enum: AREAS },
          status: { type: "string", enum: STATUSES },
          text: { type: "string" },
        },
        required: ["area", "status", "text"],
        additionalProperties: false,
      },
    },
    tomorrow: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "items", "tomorrow"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  const g = await guard<DayReviewInput>(request);
  if ("error" in g) return g.error;
  const input = g.body;
  const raw = JSON.stringify(input);
  if (!input?.day || !input.profile || !/^\d{4}-\d{2}-\d{2}$/.test(str(input.date)) || raw.length > MAX_BODY) return fail("bad_request", 400);
  const language = LANGUAGE[input.lang] ?? LANGUAGE.vi;

  const r = await askJson<DayReviewText>(g.apiKey, {
    system: SYSTEM,
    user: `Viết bằng ${language}.\n\nSố liệu ngày ${input.date}:\n${raw}`,
    schema: SCHEMA,
    effort: "medium",
  });
  if ("error" in r) return r.error;

  const review: DayReviewText = {
    headline: str(r.data.headline).slice(0, 400),
    items: (r.data.items ?? [])
      .filter((it) => AREAS.includes(it.area) && STATUSES.includes(it.status))
      .map((it) => ({ area: it.area, status: it.status, text: str(it.text).slice(0, 600) })),
    tomorrow: (r.data.tomorrow ?? []).map(str).filter(Boolean).slice(0, 5),
  };
  return json(review);
}

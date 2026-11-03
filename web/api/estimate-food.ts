// Vercel Function: POST /api/estimate-food
// Nhận mô tả bữa ăn bằng lời, nhờ Claude tách món và ước tính kcal + macro.
// Chỉ user đã đăng nhập Supabase mới gọi được (gửi access token ở header Authorization).
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { EstimateError, EstimateRequest, EstimateResponse, FoodEstimate, Meal } from "../src/lib/types";

const MODEL = "claude-opus-5-5";
const MEALS: Meal[] = ["sang", "trua", "xe", "toi", "phu"];
const MAX_TEXT = 2000;
const MAX_MY_FOODS = 200;

const SYSTEM = `Bạn là chuyên gia dinh dưỡng 20 năm kinh nghiệm, rành món ăn Việt Nam (cơm bình dân, bún phở, đồ ăn vặt, trà sữa, đồ đóng gói bán ở Việt Nam).
Người dùng mô tả những gì họ đã ăn uống. Hãy tách thành từng món và ước tính năng lượng, macro cho đúng lượng đã ăn.

Quy tắc:
- Mỗi món một dòng. Món ghép bán nguyên phần (cơm gà xối mỡ, bún bò, bánh mì thịt) để một dòng; đồ uống, món phụ ăn kèm để dòng riêng.
- "name": tên món tiếng Việt có dấu, kèm lượng trong ngoặc, vd "Cơm trắng (1 chén)", "Cà phê sữa đá (1 ly)".
- "grams": khối lượng ước tính (g hoặc ml); 0 nếu không có ý nghĩa.
- "kcal_min" và "kcal_max": khoảng hợp lý theo cách chế biến và khẩu phần thường gặp. "kcal": mức giữa để ghi vào nhật ký.
- "protein", "carb", "fat": gram, tính theo mức "kcal".
- Tính cả dầu mỡ khi chiên xào, nước sốt, đường trong đồ uống. Khẩu phần theo quán ăn Việt Nam, không theo khẩu phần Mỹ.
- Người dùng đã nêu số cụ thể (vd "mì Indomie 420 kcal") thì dùng đúng số đó: kcal = kcal_min = kcal_max.
- Nếu món khớp với danh sách "Món của tôi" bên dưới, dùng số liệu của danh sách đó (nhân theo số phần hoặc khối lượng) và ghi tên món đó vào "matched"; không khớp thì "matched" là "".
- "meal": bữa nếu người dùng có nói ("sáng" → "sang", "trưa" → "trua", "xế/chiều" → "xe", "tối" → "toi", "ăn vặt/khuya/phụ" → "phu"); không nói thì "".
- "note": giả định ngắn gọn đã dùng (vd "giả định 1 chén ~150 g, xào 1 thìa dầu"); có thể để "".
- Bỏ qua nước lọc. Thuốc, viên bổ sung không có năng lượng đáng kể thì ghi kcal 0.
- Nếu nội dung không phải mô tả đồ ăn uống, trả "items" rỗng và giải thích ngắn trong "message". Bình thường "message" là "".`;

const num = { type: "number" } as const;
const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          meal: { type: "string", enum: ["", ...MEALS] },
          grams: num,
          kcal_min: num,
          kcal_max: num,
          kcal: num,
          protein: num,
          carb: num,
          fat: num,
          matched: { type: "string" },
          note: { type: "string" },
        },
        required: ["name", "meal", "grams", "kcal_min", "kcal_max", "kcal", "protein", "carb", "fat", "matched", "note"],
        additionalProperties: false,
      },
    },
    message: { type: "string" },
  },
  required: ["items", "message"],
  additionalProperties: false,
};

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (error: EstimateError, status: number) => json({ error }, status);

const env = (name: string) => process.env[name]?.trim() || undefined;

async function currentUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_ANON_KEY");
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error ? null : data.user;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const clean = (n: unknown, max: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v * 10) / 10)) : 0;
};

function myFoodsBlock(foods: EstimateRequest["myFoods"]) {
  const lines = (Array.isArray(foods) ? foods : []).slice(0, MAX_MY_FOODS).map((f) => {
    const unit = f.basis === "serving" ? `1 ${String(f.serving_name || "phần").slice(0, 20)}` : "100 g";
    return `- ${String(f.name).slice(0, 80)} | ${unit}: ${clean(f.kcal, 9999)} kcal, P ${clean(f.protein, 999)} g, C ${clean(f.carb, 999)} g, F ${clean(f.fat, 999)} g`;
  });
  return lines.length ? lines.join("\n") : "(trống)";
}

export async function POST(request: Request) {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return fail("not_configured", 503);

  const user = await currentUser(request);
  if (!user) return fail("unauthorized", 401);
  // Giới hạn người được dùng AI (tốn phí API): danh sách email cách nhau bằng dấu phẩy
  const allowed = env("AI_ALLOWED_EMAILS")?.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed?.length && !allowed.includes(user.email?.toLowerCase() ?? "")) return fail("forbidden", 403);

  let body: EstimateRequest;
  try {
    body = (await request.json()) as EstimateRequest;
  } catch {
    return fail("bad_request", 400);
  }
  const text = str(body.text);
  if (!text || text.length > MAX_TEXT) return fail("bad_request", 400);

  const client = new Anthropic({ apiKey });
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Món của tôi (số liệu người dùng đã lưu):\n${myFoodsBlock(body.myFoods)}\n\nMô tả đã ăn uống:\n${text}`,
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${e.status}: ${e.message}`);
      return fail("upstream", 502);
    }
    throw e;
  }

  if (response.stop_reason === "refusal") return fail("refused", 422);
  const textBlock = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (response.stop_reason !== "end_turn" || !textBlock) {
    console.error(`Unexpected stop_reason ${response.stop_reason}`);
    return fail("upstream", 502);
  }

  let parsed: { items: Record<string, unknown>[]; message: string };
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    return fail("upstream", 502);
  }

  const items: FoodEstimate[] = (parsed.items ?? []).map((it) => {
    const kcal = clean(it.kcal, 5000);
    return {
      name: str(it.name).slice(0, 120) || "?",
      meal: MEALS.includes(it.meal as Meal) ? (it.meal as Meal) : null,
      grams: clean(it.grams, 5000) || null,
      kcal,
      kcal_min: Math.min(kcal, clean(it.kcal_min, 5000)),
      kcal_max: Math.max(kcal, clean(it.kcal_max, 5000)),
      protein: clean(it.protein, 500),
      carb: clean(it.carb, 1000),
      fat: clean(it.fat, 500),
      matched: str(it.matched) || null,
      note: str(it.note),
    };
  });
  return json({ items, message: str(parsed.message) } satisfies EstimateResponse);
}

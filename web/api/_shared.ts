// Phần dùng chung cho các Vercel Function trong api/. File bắt đầu bằng "_" nên Vercel không coi là một route.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { EstimateError } from "../src/lib/types";

export const MODEL = "claude-opus-5-5";

export const json = (body: unknown, status = 200) => Response.json(body, { status });
export const fail = (error: EstimateError, status: number) => json({ error }, status);

const env = (name: string) => process.env[name]?.trim() || undefined;

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Số không âm, làm tròn 1 chữ số, chặn trên `max`; không phải số thì 0. */
export const clean = (n: unknown, max: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v * 10) / 10)) : 0;
};

async function currentUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_ANON_KEY");
  if (!token || !url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
  return error ? null : data.user;
}

/**
 * Kiểm tra cấu hình, đăng nhập, quyền dùng AI và đọc body JSON.
 * Trả về `{ error }` là Response lỗi để trả thẳng cho client.
 */
export async function guard<T>(request: Request): Promise<{ apiKey: string; body: T } | { error: Response }> {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return { error: fail("not_configured", 503) };

  const user = await currentUser(request);
  if (!user) return { error: fail("unauthorized", 401) };
  // Giới hạn người được dùng AI (tốn phí API): danh sách email cách nhau bằng dấu phẩy
  const allowed = env("AI_ALLOWED_EMAILS")?.toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed?.length && !allowed.includes(user.email?.toLowerCase() ?? "")) return { error: fail("forbidden", 403) };

  try {
    return { apiKey, body: (await request.json()) as T };
  } catch {
    return { error: fail("bad_request", 400) };
  }
}

/** Một lượt hỏi Claude, bắt trả JSON đúng `schema`. Trả về object đã parse, hoặc Response lỗi. */
export async function askJson<T>(
  apiKey: string,
  req: { system: string; user: string | Anthropic.Beta.BetaContentBlockParam[]; schema: Record<string, unknown>; effort: "low" | "medium" },
): Promise<{ data: T } | { error: Response }> {
  const client = new Anthropic({ apiKey });
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: req.effort, format: { type: "json_schema", schema: req.schema } },
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${e.status}: ${e.message}`);
      return { error: fail("upstream", 502) };
    }
    throw e;
  }

  if (response.stop_reason === "refusal") return { error: fail("refused", 422) };
  const textBlock = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (response.stop_reason !== "end_turn" || !textBlock) {
    console.error(`Unexpected stop_reason ${response.stop_reason}`);
    return { error: fail("upstream", 502) };
  }
  try {
    return { data: JSON.parse(textBlock.text) as T };
  } catch {
    return { error: fail("upstream", 502) };
  }
}

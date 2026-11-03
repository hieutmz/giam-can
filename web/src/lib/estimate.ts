import { supabase } from "./supabase";
import type { CustomFood, EstimateError, EstimateRequest, EstimateResponse, FoodEstimate } from "./types";

/** Lỗi từ /api/estimate-food; `code` dùng để chọn câu thông báo theo ngôn ngữ. */
export class EstimateFailure extends Error {
  constructor(public code: EstimateError | "network") {
    super(code);
  }
}

/** Gửi mô tả bằng lời cho AI ước tính; kèm "Món của tôi" để AI dùng đúng số liệu đã lưu. */
export async function estimateFoods(text: string, myFoods: CustomFood[]): Promise<EstimateResponse> {
  const { data } = await supabase.auth.getSession();
  const body: EstimateRequest = {
    text,
    myFoods: myFoods.map(({ name, basis, serving_name, kcal, protein, carb, fat }) => ({ name, basis, serving_name, kcal, protein, carb, fat })),
  };
  let res: Response;
  try {
    res = await fetch("/api/estimate-food", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new EstimateFailure("network");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new EstimateFailure(json?.error ?? (res.status === 404 ? "not_configured" : "upstream"));
  return json as EstimateResponse;
}

/** Đổi kcal của món thì macro co giãn theo cùng tỉ lệ. */
export function scaleEstimate(e: FoodEstimate, kcal: number) {
  const k = e.kcal > 0 ? kcal / e.kcal : 0;
  const r = (n: number) => Math.round(n * k * 10) / 10;
  return { kcal: Math.round(kcal * 10) / 10, protein: r(e.protein), carb: r(e.carb), fat: r(e.fat) };
}

import { supabase } from "./supabase";
import type { CustomFood, DayReviewInput, DayReviewText, EstimateError, EstimateRequest, EstimateResponse, FoodEstimate } from "./types";

/** Lỗi từ các function trong /api; `code` dùng để chọn câu thông báo theo ngôn ngữ. */
export class ApiFailure extends Error {
  constructor(public code: EstimateError | "network") {
    super(code);
  }
}

/** POST JSON tới một Vercel Function, kèm access token của phiên đăng nhập. */
async function postApi<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiFailure("network");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw new ApiFailure(json?.error ?? (res.status === 404 ? "not_configured" : "upstream"));
  return json as T;
}

/** Gửi mô tả bằng lời cho AI ước tính; kèm "Món của tôi" để AI dùng đúng số liệu đã lưu. */
export function estimateFoods(text: string, myFoods: CustomFood[]) {
  const body: EstimateRequest = {
    text,
    myFoods: myFoods.map(({ name, basis, serving_name, kcal, protein, carb, fat }) => ({ name, basis, serving_name, kcal, protein, carb, fat })),
  };
  return postApi<EstimateResponse>("/api/estimate-food", body);
}

/** Nhờ AI tổng kết và đánh giá một ngày từ số liệu đã tính sẵn. */
export const reviewDay = (input: DayReviewInput) => postApi<DayReviewText>("/api/review-day", input);

/** Đổi kcal của món thì macro co giãn theo cùng tỉ lệ. */
export function scaleEstimate(e: FoodEstimate, kcal: number) {
  const k = e.kcal > 0 ? kcal / e.kcal : 0;
  const r = (n: number) => Math.round(n * k * 10) / 10;
  return { kcal: Math.round(kcal * 10) / 10, protein: r(e.protein), carb: r(e.carb), fat: r(e.fat) };
}

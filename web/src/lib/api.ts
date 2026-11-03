import { supabase } from "./supabase";
import type { RecentLog } from "./foods";
import type { BodyMeasurement, CustomFood, DayLog, ExerciseLog, FoodLog, Profile, StrengthSet } from "./types";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const PAGE = 1000;

/** Supabase trả tối đa 1.000 dòng mỗi lần: đọc theo trang cho tới hết. Truy vấn phải có order cố định. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(await page(from, from + PAGE - 1)) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  return check(await supabase.from("profiles").select("*").eq("id", userId).maybeSingle()) as Profile | null;
}

export async function saveProfile(p: Partial<Profile> & { id: string }) {
  check(await supabase.from("profiles").upsert({ ...p, updated_at: new Date().toISOString() }));
}

export async function getDay(date: string) {
  const [day, foods, exercises] = await Promise.all([
    supabase.from("day_logs").select("*").eq("log_date", date).maybeSingle(),
    supabase.from("food_logs").select("*").eq("log_date", date).order("created_at"),
    supabase.from("exercise_logs").select("*").eq("log_date", date).order("created_at"),
  ]);
  return {
    day: check(day) as DayLog | null,
    foods: check(foods) as FoodLog[],
    exercises: check(exercises) as ExerciseLog[],
  };
}

export async function saveDay(userId: string, d: Partial<DayLog> & { log_date: string }) {
  check(
    await supabase
      .from("day_logs")
      .upsert({ ...d, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id,log_date" }),
  );
}

export async function addFood(f: Omit<FoodLog, "id">) {
  return check(await supabase.from("food_logs").insert(f).select().single()) as FoodLog;
}

export async function addFoods(rows: Omit<FoodLog, "id">[]) {
  return check(await supabase.from("food_logs").insert(rows).select()) as FoodLog[];
}

export async function updateFood(id: string, patch: Partial<Omit<FoodLog, "id">>) {
  return check(await supabase.from("food_logs").update(patch).eq("id", id).select().single()) as FoodLog;
}

/** Các lần ghi món mới nhất, để dựng danh sách "Gần đây". */
export async function listRecentFoods(limit = 200) {
  return check(
    await supabase.from("food_logs").select("food_ref,name,grams,kcal,protein,carb,fat").order("created_at", { ascending: false }).limit(limit),
  ) as RecentLog[];
}

export async function deleteFood(id: string) {
  check(await supabase.from("food_logs").delete().eq("id", id));
}

export async function addExercise(e: Omit<ExerciseLog, "id">) {
  return check(await supabase.from("exercise_logs").insert(e).select().single()) as ExerciseLog;
}

export async function updateExercise(id: string, patch: Partial<Omit<ExerciseLog, "id">>) {
  return check(await supabase.from("exercise_logs").update(patch).eq("id", id).select().single()) as ExerciseLog;
}

export async function deleteExercise(id: string) {
  check(await supabase.from("exercise_logs").delete().eq("id", id));
}

export async function getRange(from: string, to: string) {
  const [days, foods, exercises] = await Promise.all([
    supabase.from("day_logs").select("*").gte("log_date", from).lte("log_date", to),
    fetchAll<Pick<FoodLog, "log_date" | "meal" | "name" | "kcal" | "protein" | "carb" | "fat">>((a, b) =>
      supabase
        .from("food_logs")
        .select("log_date,meal,name,kcal,protein,carb,fat")
        .gte("log_date", from)
        .lte("log_date", to)
        .order("log_date")
        .order("id")
        .range(a, b),
    ),
    fetchAll<Pick<ExerciseLog, "log_date" | "activity" | "kcal">>((a, b) =>
      supabase.from("exercise_logs").select("log_date,activity,kcal").gte("log_date", from).lte("log_date", to).order("log_date").order("id").range(a, b),
    ),
  ]);
  return { days: check(days) as DayLog[], foods, exercises };
}

/** Toàn bộ dữ liệu của user đang đăng nhập, để xuất file. */
export async function exportAll(userId: string) {
  const [profile, days, foods, exercises, custom_foods, favorites, body, strength] = await Promise.all([
    getProfile(userId),
    fetchAll<DayLog>((a, b) => supabase.from("day_logs").select("*").order("log_date").range(a, b)),
    fetchAll<FoodLog>((a, b) => supabase.from("food_logs").select("*").order("log_date").order("id").range(a, b)),
    fetchAll<ExerciseLog>((a, b) => supabase.from("exercise_logs").select("*").order("log_date").order("id").range(a, b)),
    fetchAll<CustomFood>((a, b) => supabase.from("custom_foods").select("*").order("id").range(a, b)),
    listFavorites(),
    listMeasurements(),
    listStrengthSets(),
  ]);
  return { profile, days, foods, exercises, custom_foods, favorites, body, strength };
}

export type ExportData = Awaited<ReturnType<typeof exportAll>>;

/** Xếp tăng dần theo ngày đo. */
export async function listMeasurements() {
  return check(await supabase.from("body_measurements").select("*").order("measured_on")) as BodyMeasurement[];
}

export async function saveMeasurement(id: string | null, m: Omit<BodyMeasurement, "id">) {
  if (id) check(await supabase.from("body_measurements").update(m).eq("id", id));
  else check(await supabase.from("body_measurements").insert(m));
}

export async function deleteMeasurement(id: string) {
  check(await supabase.from("body_measurements").delete().eq("id", id));
}

/** Mọi set tập tạ, xếp theo ngày rồi thứ tự ghi. */
export async function listStrengthSets() {
  return fetchAll<StrengthSet>((a, b) =>
    supabase.from("strength_sets").select("id,log_date,lift,name,reps,weight_kg,created_at").order("log_date").order("created_at").range(a, b),
  );
}

export async function addStrengthSet(s: Omit<StrengthSet, "id" | "created_at">) {
  return check(await supabase.from("strength_sets").insert(s).select("id,log_date,lift,name,reps,weight_kg,created_at").single()) as StrengthSet;
}

export async function deleteStrengthSet(id: string) {
  check(await supabase.from("strength_sets").delete().eq("id", id));
}

export async function listFavorites() {
  const rows = check(await supabase.from("favorite_foods").select("food_ref").order("created_at", { ascending: false })) as { food_ref: string }[];
  return rows.map((r) => r.food_ref);
}

export async function setFavorite(foodRef: string, on: boolean) {
  if (on) check(await supabase.from("favorite_foods").insert({ food_ref: foodRef }));
  else check(await supabase.from("favorite_foods").delete().eq("food_ref", foodRef));
}

export async function listCustomFoods(): Promise<CustomFood[]> {
  const rows = check(await supabase.from("custom_foods").select("*").order("name")) as CustomFood[];
  return rows.map((r) => ({ ...r, id: `custom:${r.id}`, group: "Món của tôi" }));
}

export type CustomFoodInput = Omit<CustomFood, "id" | "group">;

export async function addCustomFood(f: CustomFoodInput): Promise<CustomFood> {
  const row = check(await supabase.from("custom_foods").insert(f).select().single()) as CustomFood;
  return { ...row, id: `custom:${row.id}`, group: "Món của tôi" };
}

export async function updateCustomFood(id: string, f: CustomFoodInput) {
  check(await supabase.from("custom_foods").update(f).eq("id", id.replace(/^custom:/, "")));
}

export async function deleteCustomFood(id: string) {
  check(await supabase.from("custom_foods").delete().eq("id", id.replace(/^custom:/, "")));
}

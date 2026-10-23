import { supabase } from "./supabase";
import type { CustomFood, DayLog, ExerciseLog, FoodLog, Profile } from "./types";

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
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

export async function deleteFood(id: string) {
  check(await supabase.from("food_logs").delete().eq("id", id));
}

export async function addExercise(e: Omit<ExerciseLog, "id">) {
  return check(await supabase.from("exercise_logs").insert(e).select().single()) as ExerciseLog;
}

export async function deleteExercise(id: string) {
  check(await supabase.from("exercise_logs").delete().eq("id", id));
}

export async function getRange(from: string, to: string) {
  const [days, foods, exercises] = await Promise.all([
    supabase.from("day_logs").select("*").gte("log_date", from).lte("log_date", to),
    supabase.from("food_logs").select("log_date,kcal,protein,carb,fat").gte("log_date", from).lte("log_date", to),
    supabase.from("exercise_logs").select("log_date,kcal").gte("log_date", from).lte("log_date", to),
  ]);
  return {
    days: check(days) as DayLog[],
    foods: check(foods) as Pick<FoodLog, "log_date" | "kcal" | "protein" | "carb" | "fat">[],
    exercises: check(exercises) as Pick<ExerciseLog, "log_date" | "kcal">[],
  };
}

export async function listCustomFoods(): Promise<CustomFood[]> {
  const rows = check(await supabase.from("custom_foods").select("*").order("name")) as CustomFood[];
  return rows.map((r) => ({ ...r, id: `custom:${r.id}`, group: "Thực phẩm của tôi" }));
}

export type CustomFoodInput = Omit<CustomFood, "id" | "group">;

export async function addCustomFood(f: CustomFoodInput): Promise<CustomFood> {
  const row = check(await supabase.from("custom_foods").insert(f).select().single()) as CustomFood;
  return { ...row, id: `custom:${row.id}`, group: "Thực phẩm của tôi" };
}

export async function updateCustomFood(id: string, f: CustomFoodInput) {
  check(await supabase.from("custom_foods").update(f).eq("id", id.replace(/^custom:/, "")));
}

export async function deleteCustomFood(id: string) {
  check(await supabase.from("custom_foods").delete().eq("id", id.replace(/^custom:/, "")));
}

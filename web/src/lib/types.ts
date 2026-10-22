export type Meal = "sang" | "trua" | "xe" | "toi" | "phu";

export const MEALS: { id: Meal; label: string }[] = [
  { id: "sang", label: "Bữa sáng" },
  { id: "trua", label: "Bữa trưa" },
  { id: "xe", label: "Bữa xế" },
  { id: "toi", label: "Bữa tối" },
  { id: "phu", label: "Ăn vặt / đồ uống" },
];

export type Profile = {
  id: string;
  display_name: string | null;
  sex: "male" | "female";
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  bmr_override: number | null;
  activity_factor: number;
  kcal_target: number;
  protein_target: number;
  deficit_goal: number;
  start_date: string;
};

export type DayLog = {
  log_date: string;
  steps: number | null;
  water_ml: number | null;
  sleep_hours: number | null;
  weight_kg: number | null;
  note: string | null;
};

export type FoodLog = {
  id: string;
  log_date: string;
  meal: Meal;
  food_ref: string | null;
  name: string;
  grams: number | null;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
};

export type ExerciseLog = {
  id: string;
  log_date: string;
  activity: string;
  name: string;
  minutes: number;
  level: string | null;
  speed_kmh: number | null;
  incline_pct: number | null;
  kcal: number;
};

export type Food = {
  id: string;
  name: string;
  group: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
};

export type CustomFood = Omit<Food, "group"> & { group?: string };

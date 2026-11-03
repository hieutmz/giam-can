export type Meal = "sang" | "trua" | "xe" | "toi" | "phu";

export const MEALS: Meal[] = ["sang", "trua", "xe", "toi", "phu"];

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
  carb_target: number;
  fat_target: number;
  water_target_ml: number;
  sleep_target: number;
  steps_target: number;
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
  /** Thâm hụt tự chốt cho ngày này; khác null thì thay cho số tính theo công thức */
  deficit_override: number | null;
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

export type BodyMeasurement = {
  id: string;
  measured_on: string;
  weight_kg: number | null;
  pbf: number | null;
  bfm_kg: number | null;
  smm_kg: number | null;
  waist_cm: number | null;
  visceral_fat: number | null;
  note: string | null;
};

export type Food = {
  id: string;
  name: string;
  group: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  /** Giá trị dinh dưỡng tính trên 100 g (mặc định) hay trên 1 phần */
  basis?: "100g" | "serving";
  serving_name?: string | null;
};

/** Một nguyên liệu của món ghép; kcal và macro tính cho đúng lượng `amount`. */
export type RecipeItem = {
  food_ref: string | null;
  name: string;
  amount: number;
  unit: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
};

/** Chia theo khối lượng chín nếu có `cooked_g`, nếu không thì theo số phần. */
export type Recipe = {
  servings: number | null;
  cooked_g: number | null;
  items: RecipeItem[];
};

export type CustomFood = Omit<Food, "group"> & { group?: string; recipe?: Recipe | null };

/** Một món AI tách ra từ mô tả bằng lời; kcal và macro tính cho đúng lượng đã ăn. */
export type FoodEstimate = {
  name: string;
  /** Bữa người dùng có nói trong câu; null thì dùng bữa đang chọn */
  meal: Meal | null;
  grams: number | null;
  /** Mức giữa để ghi vào nhật ký */
  kcal: number;
  kcal_min: number;
  kcal_max: number;
  protein: number;
  carb: number;
  fat: number;
  /** Tên món trong "Món của tôi" đã dùng để tính */
  matched: string | null;
  note: string;
};

export type EstimateRequest = {
  text: string;
  myFoods: Pick<CustomFood, "name" | "basis" | "serving_name" | "kcal" | "protein" | "carb" | "fat">[];
};

export type EstimateResponse = { items: FoodEstimate[]; message: string };

export type EstimateError = "unauthorized" | "forbidden" | "not_configured" | "bad_request" | "refused" | "upstream";

/** Một set tập tạ. Số thứ tự set suy ra từ thứ tự ghi trong ngày. */
export type StrengthSet = {
  id: string;
  log_date: string;
  /** id trong lib/lifts.ts, hoặc "custom:<tên>" cho bài tự thêm */
  lift: string;
  name: string;
  reps: number;
  /** null: tập với trọng lượng cơ thể */
  weight_kg: number | null;
  created_at: string;
};

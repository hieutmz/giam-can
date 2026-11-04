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
  /** Kỳ kế hoạch hiện tại; null thì bắt đầu từ start_date */
  plan_start: string | null;
  plan_end: string | null;
  fat_loss_target_kg: number | null;
  /** Ghi chú sức khỏe gửi kèm khi AI tổng kết ngày, vd "men gan cao" */
  health_note: string | null;
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

export type ReviewStatus = "good" | "warn" | "bad";
export type ReviewArea = "kcal" | "protein" | "water" | "sleep" | "activity" | "food";
export const REVIEW_AREAS: ReviewArea[] = ["kcal", "protein", "water", "sleep", "activity", "food"];

/** Phần AI viết trong bản tổng kết ngày. */
export type DayReviewText = {
  headline: string;
  items: { area: ReviewArea; status: ReviewStatus; text: string }[];
  tomorrow: string[];
};

/** Số liệu tính sẵn ở trình duyệt gửi cho AI; AI chỉ nhận xét, không tự tính lại. */
export type DayReviewInput = {
  date: string;
  lang: "vi" | "en" | "zh";
  profile: {
    sex: "male" | "female";
    age: number | null;
    height_cm: number | null;
    bmr: number;
    kcal_target: number;
    protein_target: number;
    carb_target: number;
    fat_target: number;
    water_target_ml: number;
    sleep_target: number;
    steps_target: number;
    health_note: string | null;
  };
  day: {
    intake: number;
    protein: number;
    carb: number;
    fat: number;
    baseline: number;
    steps: number | null;
    steps_kcal: number;
    exercise_kcal: number;
    tdee: number;
    deficit: number;
    deficit_fixed: boolean;
    /** Ngày có được cộng vào bộ đếm không (đã ghi món hoặc tự chốt thâm hụt) */
    counted: boolean;
    water_ml: number | null;
    sleep_hours: number | null;
    weight_kg: number | null;
    note: string | null;
  };
  foods: { meal: Meal; name: string; kcal: number; protein: number }[];
  exercises: { name: string; minutes: number; kcal: number }[];
  strength: { name: string; sets: string }[];
  counter: { goal: number; total: number; pct: number; remaining: number; avg: number; eta: string | null; logged_days: number };
  /** 7 ngày gần nhất trước ngày này */
  recent: { date: string; intake: number | null; deficit: number | null }[];
};

export type DayReviewSnapshot = { intake: number; tdee: number; deficit: number; counted: boolean; counter: DayReviewInput["counter"] };

export type DayReview = { log_date: string; review: DayReviewText & { snapshot: DayReviewSnapshot }; created_at: string };

// Danh sách bài tập tạ và lịch tập gợi ý theo kế hoạch 5 buổi/tuần.
// reps: khoảng số lần mục tiêu (double progression: đủ số lần tối đa ở mọi set thì tăng tạ `step` kg).

export type LiftGroup = "chest" | "back" | "shoulders" | "arms" | "legs" | "core";
export const LIFT_GROUPS: LiftGroup[] = ["chest", "back", "shoulders", "arms", "legs", "core"];

export type Lift = {
  id: string;
  name: string;
  group: LiftGroup;
  reps: [number, number];
  step: number;
  /** Tập với trọng lượng cơ thể: tiến bộ bằng số lần thay vì số kg */
  bodyweight?: boolean;
};

export const LIFTS: Lift[] = [
  { id: "bench_press", name: "Đẩy ngực tạ đòn", group: "chest", reps: [6, 10], step: 2.5 },
  { id: "db_bench", name: "Đẩy ngực tạ đơn", group: "chest", reps: [8, 12], step: 2 },
  { id: "incline_db", name: "Đẩy ngực dốc lên tạ đơn", group: "chest", reps: [8, 12], step: 2 },
  { id: "chest_press", name: "Máy đẩy ngực", group: "chest", reps: [8, 12], step: 5 },
  { id: "pec_fly", name: "Ép ngực (máy / cáp)", group: "chest", reps: [10, 15], step: 2.5 },
  { id: "pushup", name: "Hít đất", group: "chest", reps: [8, 20], step: 0, bodyweight: true },

  { id: "lat_pulldown", name: "Kéo xô (lat pulldown)", group: "back", reps: [8, 12], step: 5 },
  { id: "seated_row", name: "Kéo cáp ngồi", group: "back", reps: [8, 12], step: 5 },
  { id: "db_row", name: "Chèo tạ đơn", group: "back", reps: [8, 12], step: 2 },
  { id: "barbell_row", name: "Chèo tạ đòn", group: "back", reps: [6, 10], step: 2.5 },
  { id: "pullup", name: "Hít xà", group: "back", reps: [5, 12], step: 0, bodyweight: true },

  { id: "ohp", name: "Đẩy vai tạ đòn", group: "shoulders", reps: [6, 10], step: 2.5 },
  { id: "db_shoulder", name: "Đẩy vai tạ đơn", group: "shoulders", reps: [8, 12], step: 2 },
  { id: "lateral_raise", name: "Dang tay ngang", group: "shoulders", reps: [12, 15], step: 1 },
  { id: "face_pull", name: "Face pull", group: "shoulders", reps: [12, 15], step: 2.5 },

  { id: "db_curl", name: "Cuốn tay trước tạ đơn", group: "arms", reps: [10, 12], step: 1 },
  { id: "hammer_curl", name: "Cuốn tay búa", group: "arms", reps: [10, 12], step: 1 },
  { id: "triceps_pushdown", name: "Đẩy cáp tay sau", group: "arms", reps: [10, 15], step: 2.5 },

  { id: "squat", name: "Squat tạ đòn", group: "legs", reps: [6, 10], step: 2.5 },
  { id: "goblet_squat", name: "Goblet squat", group: "legs", reps: [8, 12], step: 2 },
  { id: "leg_press", name: "Đạp đùi (leg press)", group: "legs", reps: [10, 15], step: 10 },
  { id: "rdl", name: "Romanian deadlift", group: "legs", reps: [8, 10], step: 2.5 },
  { id: "hip_thrust", name: "Hip thrust", group: "legs", reps: [8, 12], step: 5 },
  { id: "lunge", name: "Lunge tạ đơn", group: "legs", reps: [8, 12], step: 2 },
  { id: "leg_extension", name: "Đá đùi trước (máy)", group: "legs", reps: [10, 15], step: 5 },
  { id: "leg_curl", name: "Cuốn đùi sau (máy)", group: "legs", reps: [10, 15], step: 5 },
  { id: "calf_raise", name: "Nhón bắp chân", group: "legs", reps: [12, 20], step: 5 },

  { id: "cable_crunch", name: "Gập bụng (máy / cáp)", group: "core", reps: [12, 20], step: 2.5 },
  { id: "leg_raise", name: "Nâng chân treo xà", group: "core", reps: [10, 15], step: 0, bodyweight: true },
];

const BY_ID = new Map(LIFTS.map((l) => [l.id, l]));

/** Bài tự thêm: lưu với id "custom:<tên>", mặc định 8–12 lần, tăng 2,5 kg. */
export const CUSTOM_PREFIX = "custom:";
export const customLiftId = (name: string) => `${CUSTOM_PREFIX}${name.trim()}`;

export function liftById(id: string): Lift {
  const known = BY_ID.get(id);
  if (known) return known;
  return { id, name: id.startsWith(CUSTOM_PREFIX) ? id.slice(CUSTOM_PREFIX.length) : id, group: "core", reps: [8, 12], step: 2.5 };
}

export type PlanId = "upperA" | "lowerA" | "upperB" | "lowerB";
export const PLAN_IDS: PlanId[] = ["upperA", "lowerA", "upperB", "lowerB"];

export const PLANS: Record<PlanId, string[]> = {
  upperA: ["bench_press", "lat_pulldown", "db_shoulder", "seated_row", "db_curl", "triceps_pushdown"],
  lowerA: ["squat", "rdl", "leg_extension", "leg_curl", "calf_raise", "cable_crunch"],
  upperB: ["incline_db", "db_row", "chest_press", "lateral_raise", "face_pull", "hammer_curl"],
  lowerB: ["leg_press", "hip_thrust", "lunge", "leg_curl", "calf_raise", "leg_raise"],
};

export type DayPlan = PlanId | "cardio" | "walk" | "rest";

/** Kế hoạch tuần, theo thứ tự Date.getDay() (0 = Chủ nhật): T2 thân trên A · T3 thân dưới A · T4 cardio · T5 thân trên B · T6 thân dưới B · T7 đi bộ · CN nghỉ. */
export const WEEK_PLAN: DayPlan[] = ["rest", "upperA", "lowerA", "cardio", "upperB", "lowerB", "walk"];

export const isLiftPlan = (p: DayPlan): p is PlanId => (PLAN_IDS as string[]).includes(p);

import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import ExercisePicker from "../components/ExercisePicker";
import FoodPicker from "../components/FoodPicker";
import { deleteExercise, deleteFood, getDay, saveDay } from "../lib/api";
import { effectiveBmr, stepsKcal, summarizeDay } from "../lib/calc";
import { addDays, fmt, formatVN, today } from "../lib/date";
import { MEALS, type DayLog, type ExerciseLog, type FoodLog, type Meal } from "../lib/types";

export default function Diary() {
  const { date: param } = useParams();
  const date = param ?? today();
  const navigate = useNavigate();
  const { session, profile } = useAuth();

  const [day, setDay] = useState<DayLog | null>(null);
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [foodModal, setFoodModal] = useState<Meal | null>(null);
  const [exModal, setExModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await getDay(date);
      setDay(r.day);
      setFoods(r.foods);
      setExercises(r.exercises);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile || !session) return null;

  const weight = Number(day?.weight_kg ?? profile.weight_kg ?? 70);
  const height = Number(profile.height_cm ?? 165);
  const bmr = effectiveBmr(profile);
  const s = bmr
    ? summarizeDay({
        bmr,
        activityFactor: Number(profile.activity_factor),
        weightKg: weight,
        heightCm: height,
        foods,
        exercises,
        steps: day?.steps ?? null,
      })
    : null;

  const go = (d: string) => navigate(d === today() ? "/" : `/ngay/${d}`);

  async function updateDay(patch: Partial<DayLog>) {
    const next = { ...(day ?? emptyDay(date)), ...patch };
    setDay(next);
    try {
      await saveDay(session!.user.id, { ...patch, log_date: date });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeFood(id: string) {
    setFoods((xs) => xs.filter((x) => x.id !== id));
    await deleteFood(id).catch((e) => setError(e.message));
  }

  async function removeExercise(id: string) {
    setExercises((xs) => xs.filter((x) => x.id !== id));
    await deleteExercise(id).catch((e) => setError(e.message));
  }

  const target = profile.kcal_target;
  const pct = s ? Math.min(100, (s.intake / target) * 100) : 0;

  return (
    <div className="stack-lg">
      <div className="date-bar">
        <button className="icon-btn" onClick={() => go(addDays(date, -1))} aria-label="Ngày trước">
          ←
        </button>
        <label className="date-pick">
          <b>{date === today() ? "Hôm nay" : formatVN(date)}</b>
          <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
        </label>
        <button className="icon-btn" onClick={() => go(addDays(date, 1))} aria-label="Ngày sau">
          →
        </button>
      </div>

      {error && <p className="err">{error}</p>}

      {!bmr && (
        <div className="card warn-card">
          Chưa đủ thông tin để tính tiêu hao. <Link to="/ho-so">Cập nhật hồ sơ</Link> (chiều cao, cân nặng, năm sinh hoặc BMR từ InBody).
        </div>
      )}

      {s && (
        <section className="kpis">
          <Kpi label="Nạp vào" value={fmt(s.intake)} note={`mục tiêu ${fmt(target)}`} />
          <Kpi label="Tiêu hao" value={fmt(s.tdee)} note="BMR + sinh hoạt + tập" />
          <Kpi
            label={s.deficit >= 0 ? "Thâm hụt" : "Dư"}
            value={fmt(Math.abs(s.deficit))}
            note={foods.length ? "kcal" : "chưa nhập món ăn"}
            tone={foods.length ? (s.deficit >= 0 ? "good" : "bad") : undefined}
          />
          <Kpi
            label="Protein"
            value={`${fmt(s.protein)} g`}
            note={`mục tiêu ${profile.protein_target} g`}
            tone={s.protein >= profile.protein_target ? "good" : undefined}
          />
        </section>
      )}

      {s && (
        <div className="card">
          <div className="row-between small">
            <span>
              Đã ăn {fmt(s.intake)} / {fmt(target)} kcal
            </span>
            <span className="muted">
              {s.intake <= target ? `còn ${fmt(target - s.intake)}` : `vượt ${fmt(s.intake - target)}`}
            </span>
          </div>
          <div className={s.intake > target ? "progress over" : "progress"}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <div className="macros small muted">
            <span>Protein {fmt(s.protein, 1)} g</span>
            <span>Carb {fmt(s.carb, 1)} g</span>
            <span>Fat {fmt(s.fat, 1)} g</span>
          </div>
        </div>
      )}

      <section className="card">
        <div className="row-between">
          <h2>Ăn uống</h2>
          <button className="primary sm" onClick={() => setFoodModal(defaultMeal())}>
            + Thêm món
          </button>
        </div>
        {loading ? (
          <p className="muted">Đang tải…</p>
        ) : (
          MEALS.map((m) => {
            const items = foods.filter((f) => f.meal === m.id);
            if (!items.length) return null;
            const total = items.reduce((a, f) => a + Number(f.kcal), 0);
            return (
              <div key={m.id} className="meal">
                <div className="row-between meal-head">
                  <b>{m.label}</b>
                  <span className="num muted">{fmt(total)} kcal</span>
                </div>
                <ul className="entries">
                  {items.map((f) => (
                    <li key={f.id}>
                      <div>
                        {f.name}
                        <small className="muted">
                          {f.grams ? ` · ${fmt(Number(f.grams))} g` : ""} · P {fmt(Number(f.protein), 1)} · C {fmt(Number(f.carb), 1)} · F{" "}
                          {fmt(Number(f.fat), 1)}
                        </small>
                      </div>
                      <span className="num">{fmt(Number(f.kcal))}</span>
                      <button className="icon-btn danger" onClick={() => removeFood(f.id)} aria-label={`Xóa ${f.name}`}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
        {!loading && !foods.length && <p className="muted">Chưa có món nào.</p>}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Vận động</h2>
          <button className="primary sm" onClick={() => setExModal(true)}>
            + Thêm bài tập
          </button>
        </div>
        <ul className="entries">
          {exercises.map((e) => (
            <li key={e.id}>
              <div>
                {e.name}
                <small className="muted"> · {fmt(Number(e.minutes))} phút</small>
              </div>
              <span className="num">{fmt(Number(e.kcal))}</span>
              <button className="icon-btn danger" onClick={() => removeExercise(e.id)} aria-label={`Xóa ${e.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="field-row">
          <NumberField
            label="Bước chân"
            hint="không tính phần đi trên máy chạy"
            value={day?.steps ?? null}
            onSave={(v) => updateDay({ steps: v })}
          />
          <span className="num muted">{day?.steps ? `${fmt(stepsKcal(day.steps, weight, height))} kcal` : ""}</span>
        </div>
        {s && (
          <p className="muted small">
            Tiêu hao = nền {fmt(s.baseline)} (BMR {fmt(bmr)} × {profile.activity_factor}) + bước chân {fmt(s.stepsKcal)} + tập{" "}
            {fmt(s.exerciseKcal)} = <b>{fmt(s.tdee)} kcal</b>
          </p>
        )}
      </section>

      <section className="card">
        <h2>Sinh hoạt</h2>
        <div className="grid2">
          <div>
            <NumberField label="Nước (ml)" value={day?.water_ml ?? null} onSave={(v) => updateDay({ water_ml: v })} />
            <div className="chips">
              {[250, 500].map((n) => (
                <button key={n} className="chip" onClick={() => updateDay({ water_ml: (day?.water_ml ?? 0) + n })}>
                  +{n} ml
                </button>
              ))}
            </div>
          </div>
          <NumberField label="Giấc ngủ (giờ)" step="0.25" value={day?.sleep_hours ?? null} onSave={(v) => updateDay({ sleep_hours: v })} />
          <NumberField label="Cân nặng sáng (kg)" step="0.1" value={day?.weight_kg ?? null} onSave={(v) => updateDay({ weight_kg: v })} />
        </div>
        <label>
          Ghi chú
          <textarea
            rows={2}
            defaultValue={day?.note ?? ""}
            key={`note-${date}-${loading}`}
            onBlur={(e) => e.target.value !== (day?.note ?? "") && updateDay({ note: e.target.value || null })}
          />
        </label>
      </section>

      {foodModal && (
        <FoodPicker date={date} meal={foodModal} onClose={() => setFoodModal(null)} onAdded={(f) => setFoods((xs) => [...xs, f])} />
      )}
      {exModal && (
        <ExercisePicker date={date} weightKg={weight} onClose={() => setExModal(false)} onAdded={(e) => setExercises((xs) => [...xs, e])} />
      )}
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "good" | "bad" }) {
  return (
    <div className="kpi">
      <div className="kpi-l">{label}</div>
      <div className={`kpi-v ${tone ?? ""}`}>{value}</div>
      {note && <div className="kpi-n">{note}</div>}
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  step = "1",
  onSave,
}: {
  label: string;
  hint?: string;
  value: number | null;
  step?: string;
  onSave: (v: number | null) => void;
}) {
  const [v, setV] = useState(value?.toString() ?? "");
  useEffect(() => setV(value?.toString() ?? ""), [value]);
  const commit = () => {
    const n = v === "" ? null : Number(v);
    if (n !== value && (n === null || !Number.isNaN(n))) onSave(n);
  };
  return (
    <label>
      {label}
      {hint && <small className="muted"> ({hint})</small>}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

const emptyDay = (log_date: string): DayLog => ({ log_date, steps: null, water_ml: null, sleep_hours: null, weight_kg: null, note: null });

function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "sang";
  if (h < 14) return "trua";
  if (h < 17) return "xe";
  if (h < 21) return "toi";
  return "phu";
}

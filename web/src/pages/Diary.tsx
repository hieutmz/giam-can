import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import CopyMeals from "../components/CopyMeals";
import DayReviewCard from "../components/DayReviewCard";
import ExercisePicker from "../components/ExercisePicker";
import FoodEditor from "../components/FoodEditor";
import FoodPicker from "../components/FoodPicker";
import Icon, { type IconName } from "../components/Icon";
import MealSuggest from "../components/MealSuggest";
import Ring from "../components/Ring";
import { usePrefs } from "../i18n";
import { exerciseLabel } from "../i18n/labels";
import { deleteExercise, deleteFood, getDay, saveDay } from "../lib/api";
import { dayDeficit, effectiveBmr, stepsKcal, summarizeDay } from "../lib/calc";
import { addDays, fmt, fmtDate, today } from "../lib/date";
import { MEALS, type DayLog, type ExerciseLog, type FoodLog, type Meal } from "../lib/types";

const MEAL_ICON: Record<Meal, IconName> = { sang: "sunrise", trua: "soup", xe: "coffee", toi: "utensils", phu: "cookie" };

export default function Diary() {
  const { date: param } = useParams();
  const date = param ?? today();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const prefs = usePrefs();
  const { t } = prefs;

  const [day, setDay] = useState<DayLog | null>(null);
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [exercises, setExercises] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [foodModal, setFoodModal] = useState<Meal | null>(null);
  const [exModal, setExModal] = useState(false);
  const [editFood, setEditFood] = useState<FoodLog | null>(null);
  const [editEx, setEditEx] = useState<ExerciseLog | null>(null);
  const [copy, setCopy] = useState<{ meal?: Meal } | null>(null);

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
    void load();
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

  const isToday = date === today();
  const go = (d: string) => navigate(d === today() ? "/nhat-ky" : `/ngay/${d}`);

  async function updateDay(patch: Partial<DayLog>) {
    setDay((d) => ({ ...(d ?? emptyDay(date)), ...patch }));
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
  const left = s ? target - s.intake : target;
  const fixedDeficit = day?.deficit_override ?? null;
  const hasDeficit = foods.length > 0 || fixedDeficit != null;
  const deficit = s ? dayDeficit(s, fixedDeficit) : 0;

  return (
    <div className="page wide">
      <header className="bg-diary page-head with-action">
        <div>
          <h1>{t("nav.diary")}</h1>
          <p className="muted">{isToday ? `${t("diary.today")} · ${fmtDate(date, "long")}` : cap(fmtDate(date, "long"))}</p>
        </div>
        <div className="toolbar">
          <div className="btn-group">
            <button className="btn secondary sm icon-only" onClick={() => go(addDays(date, -1))} aria-label={t("diary.prevDay")}>
              <Icon name="left" size={16} />
            </button>
            <label className="date-field">
              <Icon name="calendar" size={16} />
              <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label={t("col.date")} />
            </label>
            <button className="btn secondary sm icon-only" onClick={() => go(addDays(date, 1))} aria-label={t("diary.nextDay")}>
              <Icon name="right" size={16} />
            </button>
          </div>
          <button className="btn secondary sm" onClick={() => go(today())} disabled={isToday}>
            {t("diary.goToday")}
          </button>
        </div>
      </header>

      {error && <p className="alert err">{error}</p>}

      {!bmr && (
        <div className="alert warn">
          {t("diary.needProfile")} <Link to="/ho-so">{t("diary.updateProfile")}</Link> ({t("diary.needProfileHint")}).
        </div>
      )}

      {s && (
        <section className="card hero">
          <Ring value={s.intake} max={target} size={152} stroke={10}>
            <span className="ring-value">{fmt(Math.abs(left))}</span>
            <span className="ring-label">{left >= 0 ? t("diary.remaining") : t("diary.over")}</span>
            <span className="ring-sub">{t("diary.eatenOf", { a: fmt(s.intake), b: fmt(target) })}</span>
          </Ring>
          <div className="hero-stats">
            <Stat icon="utensils" tone="accent" label={t("kpi.intake")} value={fmt(s.intake)} note={t("kpi.target", { n: fmt(target) })} />
            <Stat icon="flame" tone="burn" label={t("kpi.burn")} value={fmt(s.tdee)} note={t("kpi.burnNote")} />
            <Stat
              icon="trend"
              tone={!hasDeficit ? undefined : deficit >= 0 ? "good" : "bad"}
              label={deficit >= 0 ? t("kpi.deficit") : t("kpi.surplus")}
              value={hasDeficit ? fmt(Math.abs(deficit)) : "—"}
              note={fixedDeficit != null ? t("kpi.fixed") : hasDeficit ? "kcal" : t("kpi.noFood")}
            />
            <div className="macros">
              <MacroBar label={t("macro.protein")} value={s.protein} max={profile.protein_target} cls="p" />
              <MacroBar label={t("macro.carb")} value={s.carb} max={profile.carb_target} cls="c" />
              <MacroBar label={t("macro.fat")} value={s.fat} max={profile.fat_target} cls="f" />
            </div>
          </div>
        </section>
      )}

      <div className="diary-grid">
        <section className="card">
          <div className="card-head">
            <h2>
              <Icon name="utensils" size={18} /> {t("diary.food")}
            </h2>
            <div className="toolbar">
              <button className="btn secondary sm" onClick={() => setCopy({})} aria-label={t("diary.copy")}>
                <Icon name="copy" size={16} /> <span className="hide-sm">{t("diary.copy")}</span>
              </button>
              <button className="btn primary sm" onClick={() => setFoodModal(defaultMeal())}>
                <Icon name="plus" size={16} /> {t("diary.addFood")}
              </button>
            </div>
          </div>
          {loading ? (
            <p className="muted empty">{t("common.loading")}</p>
          ) : (
            MEALS.map((m) => {
              const items = foods.filter((f) => f.meal === m);
              const total = items.reduce((a, f) => a + Number(f.kcal), 0);
              return (
                <div key={m} className="meal">
                  <div className="meal-head">
                    <span className="meal-icon">
                      <Icon name={MEAL_ICON[m]} size={16} />
                    </span>
                    <b>{t(`meal.${m}`)}</b>
                    <span className="num muted">{items.length ? `${fmt(total)} kcal` : ""}</span>
                    <button className="icon-btn sm" onClick={() => setCopy({ meal: m })} aria-label={t("diary.copyTo", { meal: t(`meal.${m}`) })}>
                      <Icon name="copy" size={16} />
                    </button>
                    <button className="icon-btn sm" onClick={() => setFoodModal(m)} aria-label={t("diary.addTo", { meal: t(`meal.${m}`) })}>
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                  {items.length > 0 && (
                    <ul className="entries">
                      {items.map((f) => (
                        <li key={f.id}>
                          <div className="entry-main">
                            <span className="entry-name">{f.name}</span>
                            <small className="muted">
                              {f.grams ? `${fmt(Number(f.grams))} g · ` : ""}
                              {t("macro.p")} {fmt(Number(f.protein), 1)} · {t("macro.c")} {fmt(Number(f.carb), 1)} · {t("macro.f")}{" "}
                              {fmt(Number(f.fat), 1)}
                            </small>
                          </div>
                          <span className="num strong">{fmt(Number(f.kcal))}</span>
                          <button className="icon-btn sm" onClick={() => setEditFood(f)} aria-label={t("common.edit", { name: f.name })}>
                            <Icon name="pencil" size={16} />
                          </button>
                          <button className="icon-btn sm danger" onClick={() => removeFood(f.id)} aria-label={t("common.delete", { name: f.name })}>
                            <Icon name="trash" size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </section>

        <div className="side-col">
          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="dumbbell" size={18} /> {t("diary.exercise")}
              </h2>
              <button className="btn primary sm" onClick={() => setExModal(true)}>
                <Icon name="plus" size={16} /> {t("diary.addExercise")}
              </button>
            </div>
            {exercises.length === 0 && !loading && <p className="muted small">{t("diary.noExercise")}</p>}
            <ul className="entries">
              {exercises.map((e) => {
                const label = exerciseLabel(prefs, e);
                return (
                  <li key={e.id}>
                    <div className="entry-main">
                      <span className="entry-name">{label}</span>
                      <small className="muted">{t("common.minutes", { n: fmt(Number(e.minutes)) })}</small>
                    </div>
                    <span className="num strong burn">−{fmt(Number(e.kcal))}</span>
                    <button className="icon-btn sm" onClick={() => setEditEx(e)} aria-label={t("common.edit", { name: label })}>
                      <Icon name="pencil" size={16} />
                    </button>
                    <button className="icon-btn sm danger" onClick={() => removeExercise(e.id)} aria-label={t("common.delete", { name: label })}>
                      <Icon name="trash" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="field-row">
              <NumberField
                icon="footprints"
                label={t("diary.steps")}
                hint={t("diary.stepsHint")}
                value={day?.steps ?? null}
                onSave={(v) => updateDay({ steps: v })}
              />
              <span className="num muted">{day?.steps ? `−${fmt(stepsKcal(day.steps, weight, height))} kcal` : ""}</span>
            </div>
            <GoalLine value={day?.steps ?? null} target={profile.steps_target} unit={t("wk.stepsUnit")} />
            {s && (
              <p className="formula">
                {t("diary.formula", {
                  base: fmt(s.baseline),
                  bmr: fmt(bmr),
                  f: fmt(Number(profile.activity_factor), 2),
                  steps: fmt(s.stepsKcal),
                  ex: fmt(s.exerciseKcal),
                  tdee: fmt(s.tdee),
                })}
              </p>
            )}
            <NumberField
              icon="target"
              label={t("diary.fixedDeficit")}
              hint={t("diary.fixedHint")}
              signed
              value={fixedDeficit}
              onSave={(v) => updateDay({ deficit_override: v })}
            />
          </section>

          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="leaf" size={18} /> {t("diary.lifestyle")}
              </h2>
            </div>
            <div className="stack">
              <div>
                <NumberField icon="droplet" label={t("diary.water")} value={day?.water_ml ?? null} onSave={(v) => updateDay({ water_ml: v })} />
                <GoalLine value={day?.water_ml ?? null} target={profile.water_target_ml} unit="ml" />
                <div className="chips">
                  {[250, 500].map((n) => (
                    <button key={n} className="chip" onClick={() => updateDay({ water_ml: (day?.water_ml ?? 0) + n })}>
                      +{n} ml
                    </button>
                  ))}
                </div>
              </div>
              <div className="row2">
                <div>
                  <NumberField icon="bed" label={t("diary.sleep")} step="0.25" value={day?.sleep_hours ?? null} onSave={(v) => updateDay({ sleep_hours: v })} />
                  <GoalLine value={day?.sleep_hours ?? null} target={profile.sleep_target} unit={t("wk.hours")} digits={2} />
                </div>
                <NumberField icon="scale" label={t("diary.weight")} step="0.1" value={day?.weight_kg ?? null} onSave={(v) => updateDay({ weight_kg: v })} />
              </div>
              <label>
                <span className="label-icon">
                  <Icon name="note" size={14} /> {t("diary.note")}
                </span>
                <textarea
                  rows={3}
                  placeholder={t("diary.notePh")}
                  defaultValue={day?.note ?? ""}
                  key={`note-${date}-${loading}`}
                  onBlur={(e) => e.target.value !== (day?.note ?? "") && updateDay({ note: e.target.value || null })}
                />
              </label>
            </div>
          </section>
        </div>
      </div>

      {s && !loading && (
        <MealSuggest
          key={date}
          date={date}
          profile={profile}
          s={s}
          foods={foods}
          meal={defaultMeal()}
          onAdded={(rows) => setFoods((xs) => [...xs, ...rows])}
        />
      )}

      {s && bmr && !loading && (
        <DayReviewCard date={date} profile={profile} bmr={bmr} s={s} day={day} foods={foods} exercises={exercises} />
      )}

      {foodModal && <FoodPicker date={date} meal={foodModal} onClose={() => setFoodModal(null)} onAdded={(f) => setFoods((xs) => [...xs, f])} />}
      {exModal && (
        <ExercisePicker date={date} weightKg={weight} onClose={() => setExModal(false)} onSaved={(e) => setExercises((xs) => [...xs, e])} />
      )}
      {editEx && (
        <ExercisePicker
          date={date}
          weightKg={weight}
          initial={editEx}
          onClose={() => setEditEx(null)}
          onSaved={(e) => setExercises((xs) => xs.map((x) => (x.id === e.id ? e : x)))}
        />
      )}
      {editFood && (
        <FoodEditor log={editFood} onClose={() => setEditFood(null)} onSaved={(f) => setFoods((xs) => xs.map((x) => (x.id === f.id ? f : x)))} />
      )}
      {copy && <CopyMeals date={date} meal={copy.meal} onClose={() => setCopy(null)} onCopied={(rows) => setFoods((xs) => [...xs, ...rows])} />}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  note?: string;
  tone?: "accent" | "burn" | "good" | "bad";
}) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <span className="stat-icon">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {note && <div className="stat-note">{note}</div>}
      </div>
    </div>
  );
}

function MacroBar({ label, value, max, cls }: { label: string; value: number; max?: number; cls: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 100;
  return (
    <div className={`macro ${cls}`}>
      <div className="macro-top">
        <span>{label}</span>
        <span className="num">
          {fmt(value)}
          {max ? ` / ${fmt(max)}` : ""} g
        </span>
      </div>
      {max ? (
        <div className="bar">
          <div style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <div className="bar ghost" />
      )}
    </div>
  );
}

/** Tiến độ so với mục tiêu ngày; chưa có mục tiêu thì không hiện. */
function GoalLine({ value, target, unit, digits = 0 }: { value: number | null; target?: number | null; unit: string; digits?: number }) {
  const goal = Number(target);
  if (!goal) return null;
  const current = Number(value ?? 0);
  return (
    <div className={current >= goal ? "goal done" : "goal"}>
      <div className="bar">
        <div style={{ width: `${Math.min(100, (current / goal) * 100)}%` }} />
      </div>
      <small className="num">
        {fmt(current, digits)} / {fmt(goal, digits)} {unit}
      </small>
    </div>
  );
}

function NumberField({
  icon,
  label,
  hint,
  value,
  step = "1",
  signed,
  onSave,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  value: number | null;
  step?: string;
  /** Cho phép số âm */
  signed?: boolean;
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
      <span className="label-icon">
        {icon && <Icon name={icon} size={14} />} {label}
        {hint && <small className="muted">{hint}</small>}
      </span>
      <input
        type="number"
        inputMode={signed ? "text" : "decimal"}
        min={signed ? undefined : "0"}
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

const emptyDay = (log_date: string): DayLog => ({
  log_date,
  steps: null,
  water_ml: null,
  sleep_hours: null,
  weight_kg: null,
  note: null,
  deficit_override: null,
});

function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "sang";
  if (h < 14) return "trua";
  if (h < 17) return "xe";
  if (h < 21) return "toi";
  return "phu";
}

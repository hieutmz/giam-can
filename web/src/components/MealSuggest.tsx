import { useState } from "react";
import { usePrefs } from "../i18n";
import { ApiFailure, compactFoods, suggestMeal } from "../lib/ai";
import { addFoods, listCustomFoods } from "../lib/api";
import type { DaySummary } from "../lib/calc";
import { fmt } from "../lib/date";
import { MEALS, type FoodLog, type Meal, type Profile, type SuggestOption } from "../lib/types";
import Icon from "./Icon";

/** Thiếu ít hơn chừng này gram protein thì không nhắc */
const PROTEIN_GAP = 10;

const total = (o: SuggestOption) => o.items.reduce((a, it) => ({ kcal: a.kcal + it.kcal, protein: a.protein + it.protein }), { kcal: 0, protein: 0 });

/** Gợi ý món cho bữa tiếp theo để bù protein còn thiếu mà không vượt kcal còn lại. */
export default function MealSuggest({
  date,
  profile,
  s,
  foods,
  meal: initialMeal,
  onAdded,
}: {
  date: string;
  profile: Profile;
  s: DaySummary;
  foods: FoodLog[];
  meal: Meal;
  onAdded: (rows: FoodLog[]) => void;
}) {
  const { t, tx, lang } = usePrefs();
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [options, setOptions] = useState<SuggestOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const remaining = {
    kcal: profile.kcal_target - s.intake,
    protein: profile.protein_target - s.protein,
    carb: profile.carb_target - s.carb,
    fat: profile.fat_target - s.fat,
  };
  if (remaining.protein < PROTEIN_GAP && !options) return null;

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const myFoods = await listCustomFoods().catch(() => []);
      const res = await suggestMeal({
        lang,
        meal,
        remaining,
        eaten: foods.map((f) => f.name),
        health_note: profile.health_note?.trim() || null,
        myFoods: compactFoods(myFoods),
      });
      setOptions(res.options);
    } catch (e) {
      setErr(e instanceof ApiFailure ? tx(`ai.err.${e.code}`, t("ai.err.upstream")) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function add(o: SuggestOption) {
    setBusy(true);
    setErr("");
    try {
      const rows = await addFoods(
        o.items.map((it) => ({ log_date: date, meal, food_ref: null, name: it.name, grams: it.grams, kcal: it.kcal, protein: it.protein, carb: it.carb, fat: it.fat })),
      );
      onAdded(rows);
      setOptions(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <div className="card-head">
        <h2>
          <Icon name="sparkles" size={18} /> {t("sg2.title")}
        </h2>
      </div>
      <p className="small">
        {remaining.kcal >= 0
          ? t("sg2.gap", { kcal: fmt(remaining.kcal), p: fmt(Math.max(0, remaining.protein)) })
          : t("sg2.gapOver", { kcal: fmt(-remaining.kcal), p: fmt(Math.max(0, remaining.protein)) })}
      </p>
      <div className="suggest-bar">
        <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)} aria-label={t("fp.meal")}>
          {MEALS.map((m) => (
            <option key={m} value={m}>
              {t(`meal.${m}`)}
            </option>
          ))}
        </select>
        <button className="btn primary" onClick={run} disabled={busy}>
          <Icon name="sparkles" size={16} /> {busy && !options ? t("sg2.thinking") : t(options ? "sg2.again" : "sg2.run")}
        </button>
      </div>
      {options && options.length === 0 && <p className="muted small">{t("common.noResults")}</p>}
      {options && options.length > 0 && (
        <div className="suggest-options">
          {options.map((o) => {
            const sum = total(o);
            return (
              <div key={o.title} className="suggest-option">
                <div className="row-between">
                  <b>{o.title}</b>
                  {o.where && <span className="pill">{o.where}</span>}
                </div>
                <ul>
                  {o.items.map((it) => (
                    <li key={it.name}>
                      <span>{it.name}</span>
                      <small className="muted num">
                        {fmt(it.kcal)} kcal · {t("macro.p")} {fmt(it.protein, 1)}
                      </small>
                    </li>
                  ))}
                </ul>
                <div className="row-between small">
                  <b className="num">
                    {fmt(sum.kcal)} kcal · {t("macro.p")} {fmt(sum.protein)} g
                  </b>
                  <button className="btn secondary sm" disabled={busy} onClick={() => add(o)}>
                    <Icon name="plus" size={14} /> {t("sg2.add", { meal: t(`meal.${meal}`) })}
                  </button>
                </div>
                {o.note && <small className="muted">{o.note}</small>}
              </div>
            );
          })}
        </div>
      )}
      {err && <p className="alert err">{err}</p>}
    </section>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { usePrefs } from "../i18n";
import { listCustomFoods, updateFood } from "../lib/api";
import { roundNutrients, scale, type Nutrients } from "../lib/calc";
import { FOODS, loggedAmount, servingLabel } from "../lib/foods";
import { MEALS, type Food, type FoodLog, type Meal } from "../lib/types";
import Modal from "./Modal";

const asText = (n: Nutrients) => ({ kcal: String(n.kcal), protein: String(n.protein), carb: String(n.carb), fat: String(n.fat) });

/** Sửa một món đã ghi. Đổi lượng ăn thì kcal và macro tính lại theo tỉ lệ từ số đã lưu của chính dòng này. */
export default function FoodEditor({ log, onSaved, onClose }: { log: FoodLog; onSaved: (f: FoodLog) => void; onClose: () => void }) {
  const { t } = usePrefs();
  const servingWord = t("unit.serving");
  const saved: Nutrients = { kcal: Number(log.kcal), protein: Number(log.protein), carb: Number(log.carb), fat: Number(log.fat) };
  const [meal, setMeal] = useState<Meal>(log.meal);
  const [name, setName] = useState(log.name);
  const [values, setValues] = useState(asText(saved));
  const [amount, setAmount] = useState(log.grams != null ? String(Number(log.grams)) : "");
  const [servingFood, setServingFood] = useState<Pick<Food, "name" | "kcal" | "basis" | "serving_name"> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const byGrams = log.grams != null;
  const unit = servingFood?.serving_name || servingWord;
  const savedAmount = byGrams ? Number(log.grams) : servingFood ? loggedAmount(log, servingFood) : null;

  // Món theo phần không lưu số phần: tìm lại món gốc để suy ra
  useEffect(() => {
    if (byGrams || !log.food_ref) return;
    let active = true;
    listCustomFoods()
      .catch(() => [])
      .then((custom) => {
        const food = [...custom, ...FOODS].find((f) => f.id === log.food_ref);
        if (!active || food?.basis !== "serving") return;
        setServingFood(food);
        setAmount(String(loggedAmount(log, food)));
      });
    return () => {
      active = false;
    };
  }, [log, byGrams]);

  function changeAmount(text: string) {
    setAmount(text);
    const n = Number(text);
    if (!(n > 0) || !savedAmount) return;
    setValues(asText(roundNutrients(scale(saved, n / savedAmount))));
    if (servingFood) setName(servingLabel(servingFood.name, n, unit));
  }

  const setValue = (k: keyof Nutrients, v: string) => setValues((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      onSaved(
        await updateFood(log.id, {
          meal,
          name: name.trim(),
          grams: byGrams ? Number(amount) : null,
          kcal: Number(values.kcal),
          protein: Number(values.protein) || 0,
          carb: Number(values.carb) || 0,
          fat: Number(values.fat) || 0,
        }),
      );
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={t("fe.title")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          {t("cf.name")}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        {savedAmount != null && (
          <label>
            {byGrams ? t("fp.qtyGrams") : t("fp.qtyServing", { unit })}
            <input
              type="number"
              inputMode="decimal"
              min={byGrams ? "1" : "0.1"}
              step="any"
              value={amount}
              onChange={(e) => changeAmount(e.target.value)}
              required
            />
            <small className="muted">{t("fe.scaleHint")}</small>
          </label>
        )}
        <label>
          {t("fp.totalKcal")}
          <input type="number" inputMode="decimal" min="0" step="any" value={values.kcal} onChange={(e) => setValue("kcal", e.target.value)} required />
        </label>
        <div className="row3">
          <label>
            {t("cf.proteinG")}
            <input type="number" inputMode="decimal" min="0" step="any" value={values.protein} onChange={(e) => setValue("protein", e.target.value)} />
          </label>
          <label>
            {t("cf.carbG")}
            <input type="number" inputMode="decimal" min="0" step="any" value={values.carb} onChange={(e) => setValue("carb", e.target.value)} />
          </label>
          <label>
            {t("cf.fatG")}
            <input type="number" inputMode="decimal" min="0" step="any" value={values.fat} onChange={(e) => setValue("fat", e.target.value)} />
          </label>
        </div>
        <label>
          {t("fp.meal")}
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t(`meal.${m}`)}
              </option>
            ))}
          </select>
        </label>
        {err && <p className="alert err">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          {t("common.save")}
        </button>
      </form>
    </Modal>
  );
}

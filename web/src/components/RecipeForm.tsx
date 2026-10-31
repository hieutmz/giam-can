import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePrefs } from "../i18n";
import { listCustomFoods, type CustomFoodInput } from "../lib/api";
import { amountNutrition, recipeUnit, roundNutrients, scale, sumNutrients, type Nutrients } from "../lib/calc";
import { fmt } from "../lib/date";
import { FOODS, searchFoods, unitLabel } from "../lib/foods";
import type { CustomFood, Food, RecipeItem } from "../lib/types";
import Icon from "./Icon";

/** Nguyên liệu đang sửa: `per` là dinh dưỡng trên 1 đơn vị, để đổi lượng không bị sai số cộng dồn. */
type Row = { key: string; food_ref: string | null; name: string; unit: string; amount: string; per: Nutrients };

function rowFromItem(item: RecipeItem, i: number): Row {
  return {
    key: `${item.food_ref ?? item.name}-${i}`,
    food_ref: item.food_ref,
    name: item.name,
    unit: item.unit,
    amount: String(item.amount),
    per: scale(item, 1 / (Number(item.amount) || 1)),
  };
}

const nutrientsOf = (r: Row) => scale(r.per, Number(r.amount) || 0);

/** Tạo / sửa món ghép từ nhiều nguyên liệu. Kết quả là một "Món của tôi" kèm công thức. */
export default function RecipeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: CustomFood;
  submitLabel: string;
  onSubmit: (f: CustomFoodInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = usePrefs();
  const servingWord = t("unit.serving");
  const recipe = initial?.recipe;
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<Row[]>(() => recipe?.items.map(rowFromItem) ?? []);
  const [byCooked, setByCooked] = useState(Boolean(recipe?.cooked_g));
  const [servings, setServings] = useState(String(recipe?.servings ?? 1));
  const [cooked, setCooked] = useState(recipe?.cooked_g ? String(recipe.cooked_g) : "");
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listCustomFoods()
      .then((list) => setCustom(list.filter((f) => f.id !== initial?.id)))
      .catch(() => setCustom([]));
  }, [initial?.id]);

  const results = useMemo(() => (query.trim() ? searchFoods<CustomFood | Food>([...custom, ...FOODS], query, 8) : []), [custom, query]);

  const split = { servings: byCooked ? null : Number(servings) || null, cooked_g: byCooked ? Number(cooked) || null : null };
  const splitOk = byCooked ? (split.cooked_g ?? 0) > 0 : (split.servings ?? 0) > 0;
  const nutrients = rows.map(nutrientsOf);
  const total = sumNutrients(nutrients);
  const unit = recipeUnit(nutrients, split);
  const valid = rows.length > 0 && rows.every((r) => Number(r.amount) > 0) && splitOk;

  function addIngredient(f: CustomFood | Food) {
    const serving = f.basis === "serving";
    setRows((xs) => [
      ...xs,
      {
        key: `${f.id}-${Date.now()}`,
        food_ref: f.id,
        name: f.name,
        unit: serving ? f.serving_name || servingWord : "g",
        amount: serving ? "1" : "100",
        per: amountNutrition(f, 1),
      },
    ]);
    setQuery("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setErr("");
    try {
      await onSubmit({
        name: name.trim(),
        basis: unit.basis,
        serving_name: unit.basis === "serving" ? servingWord : null,
        ...roundNutrients(unit),
        recipe: {
          ...split,
          items: rows.map((r) => ({
            food_ref: r.food_ref,
            name: r.name,
            amount: Number(r.amount),
            unit: r.unit,
            ...roundNutrients(nutrientsOf(r)),
          })),
        },
      });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        {t("cf.name")}
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("rc.namePh")} />
      </label>

      <div className="stack">
        <span className="label">{t("rc.ingredients")}</span>
        <div className="search">
          <Icon name="search" size={18} />
          <input placeholder={t("rc.searchPh")} aria-label={t("rc.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query.trim() && (
          <ul className="pick-list">
            {results.map((f) => (
              <li key={f.id}>
                <button type="button" className="pick-main" onClick={() => addIngredient(f)}>
                  <span className="pick-name">{f.name}</span>
                  <span className="pick-kcal">
                    <b>{fmt(f.kcal)}</b> kcal
                    <small>/{unitLabel(f, servingWord)}</small>
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="pick-empty">{t("common.noResults")}</li>}
          </ul>
        )}
        {rows.length === 0 ? (
          <p className="muted small">{t("rc.empty")}</p>
        ) : (
          <ul className="recipe-rows">
            {rows.map((r) => (
              <li key={r.key}>
                <span className="recipe-name">{r.name}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={r.amount}
                  aria-label={t("rc.amount", { name: r.name })}
                  onChange={(e) => setRows((xs) => xs.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))}
                />
                <span className="muted small recipe-unit">{r.unit}</span>
                <span className="num strong">{fmt(nutrientsOf(r).kcal)}</span>
                <button
                  type="button"
                  className="icon-btn sm danger"
                  aria-label={t("common.delete", { name: r.name })}
                  onClick={() => setRows((xs) => xs.filter((x) => x.key !== r.key))}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="stack">
        <span className="label">{t("rc.split")}</span>
        <div className="seg">
          <button type="button" className={byCooked ? "" : "active"} onClick={() => setByCooked(false)}>
            {t("rc.byServing")}
          </button>
          <button type="button" className={byCooked ? "active" : ""} onClick={() => setByCooked(true)}>
            {t("rc.byCooked")}
          </button>
        </div>
        {byCooked ? (
          <label>
            {t("rc.cooked")}
            <input type="number" inputMode="decimal" min="1" step="any" value={cooked} onChange={(e) => setCooked(e.target.value)} required />
          </label>
        ) : (
          <label>
            {t("rc.servings")}
            <input type="number" inputMode="decimal" min="0.1" step="any" value={servings} onChange={(e) => setServings(e.target.value)} required />
          </label>
        )}
      </div>

      {rows.length > 0 && (
        <div className="preview">
          <div>
            <span className="muted small">{unit.basis === "serving" ? t("rc.perServing") : t("rc.per100")}</span>
            <b className="big">{fmt(splitOk ? unit.kcal : null)} kcal</b>
            <span className="muted small">{t("rc.total", { n: fmt(total.kcal) })}</span>
          </div>
          {splitOk && (
            <div className="macro-pills">
              <span className="pill p">
                {t("macro.p")} {fmt(unit.protein, 1)} g
              </span>
              <span className="pill c">
                {t("macro.c")} {fmt(unit.carb, 1)} g
              </span>
              <span className="pill f">
                {t("macro.f")} {fmt(unit.fat, 1)} g
              </span>
            </div>
          )}
        </div>
      )}

      {err && <p className="alert err">{err}</p>}
      <div className="row2">
        <button type="button" className="btn secondary" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button className="btn primary" disabled={busy || !valid}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

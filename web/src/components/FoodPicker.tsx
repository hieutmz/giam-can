import { useEffect, useMemo, useState, type FormEvent } from "react";
import { usePrefs } from "../i18n";
import { groupLabel } from "../i18n/labels";
import { addCustomFood, addFood, listCustomFoods } from "../lib/api";
import { amountNutrition } from "../lib/calc";
import { fmt } from "../lib/date";
import { FOODS, searchFoods, unitLabel } from "../lib/foods";
import { MEALS, type CustomFood, type FoodLog, type Meal } from "../lib/types";
import CustomFoodForm from "./CustomFoodForm";
import Icon from "./Icon";
import Modal from "./Modal";

type Item = {
  id: string;
  name: string;
  group?: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  basis?: "100g" | "serving";
  serving_name?: string | null;
};
type Tab = "search" | "quick" | "create";
type Macros = { kcal: number; protein: number; carb: number; fat: number };

export default function FoodPicker({
  date,
  meal: initialMeal,
  onAdded,
  onClose,
}: {
  date: string;
  meal: Meal;
  onAdded: (f: FoodLog) => void;
  onClose: () => void;
}) {
  const { t } = usePrefs();
  const servingWord = t("unit.serving");
  const [tab, setTab] = useState<Tab>("search");
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listCustomFoods()
      .then(setCustom)
      .catch(() => setCustom([]));
  }, []);

  const mine = useMemo(() => searchFoods(custom, query, 50), [custom, query]);
  const system = useMemo(() => searchFoods(FOODS, query, 40), [query]);
  const isServing = picked?.basis === "serving";
  const a = Number(amount) || 0;
  const p = picked ? amountNutrition(picked, a) : null;
  const unitName = picked?.serving_name || servingWord;

  function pick(f: Item) {
    setPicked(f);
    setAmount(f.basis === "serving" ? "1" : "100");
  }

  async function save(row: Omit<FoodLog, "id">) {
    setBusy(true);
    setErr("");
    try {
      onAdded(await addFood(row));
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  function addPicked(e: FormEvent) {
    e.preventDefault();
    if (!picked || !p || a <= 0) return;
    void save({
      log_date: date,
      meal,
      food_ref: picked.id,
      name: isServing ? `${picked.name} (${fmt(a, 2)} ${unitName})` : picked.name,
      grams: isServing ? null : a,
      ...round(p),
    });
  }

  const mealSelect = (
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
  );

  const amountChips = isServing ? [0.5, 1, 1.5, 2, 3] : [50, 100, 150, 200, 250, 300];

  return (
    <Modal title={t("fp.title")} onClose={onClose}>
      <div className="seg">
        <button type="button" className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>
          {t("fp.tabSearch")}
        </button>
        <button type="button" className={tab === "quick" ? "active" : ""} onClick={() => setTab("quick")}>
          {t("fp.tabQuick")}
        </button>
        <button type="button" className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>
          {t("fp.tabCreate")}
        </button>
      </div>

      {tab === "search" && !picked && (
        <div className="stack">
          <div className="search">
            <Icon name="search" size={18} />
            <input autoFocus placeholder={t("fp.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="pick-scroll">
            <div className="pick-head">
              <span>
                <Icon name="star" size={14} /> {t("fp.mine")}
              </span>
              <button type="button" className="link small" onClick={() => setTab("create")}>
                + {t("fp.createShort")}
              </button>
            </div>
            <ul className="pick-list">
              {mine.map((f) => (
                <PickRow key={f.id} f={f} onPick={pick} mine />
              ))}
              {mine.length === 0 && (
                <li className="pick-empty">{custom.length === 0 ? t("fp.noMine") : t("fp.noMineMatch", { q: query })}</li>
              )}
            </ul>

            <div className="pick-head">
              <span>
                <Icon name="apple" size={14} /> {t("fp.system")}
              </span>
              <span>{t("fp.per100")}</span>
            </div>
            <ul className="pick-list">
              {system.map((f) => (
                <PickRow key={f.id} f={f} onPick={pick} />
              ))}
              {system.length === 0 && (
                <li className="pick-empty stack">
                  <span>{t("fp.notFound", { q: query })}</span>
                  <button type="button" className="btn secondary" onClick={() => setTab("create")}>
                    <Icon name="plus" size={16} /> {t("fp.createNamed", { q: query })}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {tab === "search" && picked && p && (
        <form className="stack" onSubmit={addPicked}>
          <button type="button" className="link back" onClick={() => setPicked(null)}>
            <Icon name="left" size={16} /> {t("fp.back")}
          </button>
          <div className="picked">
            <b>{picked.name}</b>
            <span className="muted small">
              {unitLabel(picked, servingWord)}: {fmt(picked.kcal)} kcal · {t("macro.p")} {fmt(picked.protein, 1)} g · {t("macro.c")}{" "}
              {fmt(picked.carb, 1)} g · {t("macro.f")} {fmt(picked.fat, 1)} g
            </span>
          </div>
          <label>
            {isServing ? t("fp.qtyServing", { unit: unitName }) : t("fp.qtyGrams")}
            <input
              type="number"
              inputMode="decimal"
              min={isServing ? "0.1" : "1"}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </label>
          <div className="chips">
            {amountChips.map((n) => (
              <button type="button" key={n} className={a === n ? "chip active" : "chip"} onClick={() => setAmount(String(n))}>
                {isServing ? `${fmt(n, 1)} ${unitName}` : `${n} g`}
              </button>
            ))}
          </div>
          {mealSelect}
          <Preview p={p} />
          {err && <p className="alert err">{err}</p>}
          <button className="btn primary block" disabled={busy || a <= 0}>
            {t("fp.add")}
          </button>
        </form>
      )}

      {tab === "quick" && (
        <QuickAdd
          mealSelect={mealSelect}
          busy={busy}
          err={err}
          onSave={async (r, remember) => {
            if (remember) {
              try {
                const f = await addCustomFood({ ...r, basis: "serving", serving_name: servingWord });
                setCustom((xs) => [f, ...xs]);
              } catch (e) {
                setErr((e as Error).message);
                return;
              }
            }
            await save({ log_date: date, meal, food_ref: null, grams: null, ...r });
          }}
        />
      )}

      {tab === "create" && (
        <>
          <p className="hint">{t("fp.createHint")}</p>
          <CustomFoodForm
            key={query}
            initialName={query}
            submitLabel={t("my.saveNew")}
            onCancel={() => setTab("search")}
            onSubmit={async (input) => {
              const f = await addCustomFood(input);
              setCustom((xs) => [f, ...xs]);
              pick(f);
              setTab("search");
            }}
          />
        </>
      )}
    </Modal>
  );
}

function PickRow({ f, onPick, mine }: { f: Item; onPick: (f: Item) => void; mine?: boolean }) {
  const prefs = usePrefs();
  return (
    <li>
      <button type="button" onClick={() => onPick(f)}>
        <span className="pick-name">
          {f.name}
          {!mine && f.group && <small>{groupLabel(prefs, f.group)}</small>}
        </span>
        <span className="pick-kcal">
          <b>{fmt(f.kcal)}</b> kcal
          <small>/{unitLabel(f, prefs.t("unit.serving"))}</small>
        </span>
      </button>
    </li>
  );
}

function Preview({ p }: { p: Macros }) {
  const { t } = usePrefs();
  return (
    <div className="preview">
      <div>
        <span className="muted small">{t("fp.energy")}</span>
        <b className="big">{fmt(p.kcal)} kcal</b>
      </div>
      <div className="macro-pills">
        <span className="pill p">
          {t("macro.p")} {fmt(p.protein, 1)} g
        </span>
        <span className="pill c">
          {t("macro.c")} {fmt(p.carb, 1)} g
        </span>
        <span className="pill f">
          {t("macro.f")} {fmt(p.fat, 1)} g
        </span>
      </div>
    </div>
  );
}

type QuickRow = Pick<FoodLog, "name" | "kcal" | "protein" | "carb" | "fat">;

function QuickAdd({
  mealSelect,
  busy,
  err,
  onSave,
}: {
  mealSelect: JSX.Element;
  busy: boolean;
  err: string;
  onSave: (r: QuickRow, remember: boolean) => Promise<void>;
}) {
  const { t } = usePrefs();
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");
  const [remember, setRemember] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(
          { name: name.trim(), kcal: Number(kcal), protein: Number(protein) || 0, carb: Number(carb) || 0, fat: Number(fat) || 0 },
          remember,
        );
      }}
    >
      <p className="hint">{t("fp.quickHint")}</p>
      <label>
        {t("cf.name")}
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("cf.namePh")} />
      </label>
      <label>
        {t("fp.totalKcal")}
        <input type="number" inputMode="decimal" min="0" step="any" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
      </label>
      <div className="row3">
        <label>
          {t("cf.proteinG")}
          <input type="number" inputMode="decimal" min="0" step="any" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </label>
        <label>
          {t("cf.carbG")}
          <input type="number" inputMode="decimal" min="0" step="any" value={carb} onChange={(e) => setCarb(e.target.value)} />
        </label>
        <label>
          {t("cf.fatG")}
          <input type="number" inputMode="decimal" min="0" step="any" value={fat} onChange={(e) => setFat(e.target.value)} />
        </label>
      </div>
      {mealSelect}
      <label className="check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>{t("fp.remember")}</span>
      </label>
      {err && <p className="alert err">{err}</p>}
      <button className="btn primary block" disabled={busy}>
        {t("fp.add")}
      </button>
    </form>
  );
}

const round = (p: Macros) => ({
  kcal: Math.round(p.kcal * 10) / 10,
  protein: Math.round(p.protein * 10) / 10,
  carb: Math.round(p.carb * 10) / 10,
  fat: Math.round(p.fat * 10) / 10,
});

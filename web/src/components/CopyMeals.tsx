import { useEffect, useState } from "react";
import { usePrefs } from "../i18n";
import { addFoods, getDay } from "../lib/api";
import { addDays, fmt, fmtDate } from "../lib/date";
import { MEALS, type FoodLog, type Meal } from "../lib/types";
import Modal from "./Modal";

/** Chép món từ một ngày khác vào đúng bữa tương ứng của ngày đang xem. */
export default function CopyMeals({
  date,
  meal,
  onCopied,
  onClose,
}: {
  date: string;
  meal?: Meal;
  onCopied: (rows: FoodLog[]) => void;
  onClose: () => void;
}) {
  const { t } = usePrefs();
  const [source, setSource] = useState(addDays(date, -1));
  const [foods, setFoods] = useState<FoodLog[] | null>(null);
  const [selected, setSelected] = useState<Set<Meal>>(new Set(meal ? [meal] : MEALS));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    setFoods(null);
    setErr("");
    getDay(source)
      .then((r) => active && setFoods(r.foods))
      .catch((e) => active && setErr(e.message));
    return () => {
      active = false;
    };
  }, [source]);

  const sameDay = source === date;
  const meals = MEALS.map((m) => ({ meal: m, items: (foods ?? []).filter((f) => f.meal === m) })).filter((x) => x.items.length > 0);
  const chosen = meals.filter((x) => selected.has(x.meal)).flatMap((x) => x.items);

  function toggle(m: Meal) {
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(m)) next.add(m);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      onCopied(
        await addFoods(
          chosen.map((f) => ({
            log_date: date,
            meal: f.meal,
            food_ref: f.food_ref,
            name: f.name,
            grams: f.grams,
            kcal: f.kcal,
            protein: f.protein,
            carb: f.carb,
            fat: f.fat,
          })),
        ),
      );
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={t("cp.title")} onClose={onClose}>
      <div className="stack">
        <label>
          {t("cp.source")}
          <input type="date" value={source} onChange={(e) => e.target.value && setSource(e.target.value)} />
        </label>
        {sameDay ? (
          <p className="alert warn">{t("cp.sameDay")}</p>
        ) : foods === null ? (
          !err && <p className="muted">{t("common.loading")}</p>
        ) : meals.length === 0 ? (
          <p className="muted">{t("cp.empty")}</p>
        ) : (
          <>
            <div className="copy-list">
              {meals.map(({ meal: m, items }) => (
                <label key={m} className="check">
                  <input type="checkbox" checked={selected.has(m)} onChange={() => toggle(m)} />
                  <span>
                    <b>{t(`meal.${m}`)}</b> · {fmt(items.reduce((a, f) => a + Number(f.kcal), 0))} kcal
                    <small className="muted">{items.map((f) => f.name).join(", ")}</small>
                  </span>
                </label>
              ))}
            </div>
            <p className="hint">{t("cp.hint", { date: fmtDate(date, "short") })}</p>
          </>
        )}
        {err && <p className="alert err">{err}</p>}
        <button type="button" className="btn primary block" disabled={busy || sameDay || chosen.length === 0} onClick={submit}>
          {t("cp.submit", { n: chosen.length })}
        </button>
      </div>
    </Modal>
  );
}

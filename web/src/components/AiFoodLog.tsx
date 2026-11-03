import { useState, type FormEvent } from "react";
import { usePrefs } from "../i18n";
import { addFoods } from "../lib/api";
import { fmt } from "../lib/date";
import { EstimateFailure, estimateFoods, scaleEstimate } from "../lib/estimate";
import { MEALS, type CustomFood, type FoodEstimate, type FoodLog, type Meal } from "../lib/types";
import Icon from "./Icon";

type Row = { key: number; est: FoodEstimate; on: boolean; name: string; meal: Meal; kcal: string };

/** Ghi món bằng câu mô tả: AI tách món và ước tính, người dùng xem lại rồi mới thêm vào nhật ký. */
export default function AiFoodLog({
  date,
  meal,
  myFoods,
  onSaved,
}: {
  date: string;
  /** Bữa dùng cho món mà câu mô tả không nói rõ bữa */
  meal: Meal;
  myFoods: CustomFood[];
  onSaved: (rows: FoodLog[]) => void;
}) {
  const { t, tx } = usePrefs();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const chosen = (rows ?? []).filter((r) => r.on && r.name.trim() && Number(r.kcal) >= 0);
  const total = chosen.reduce((a, r) => a + (Number(r.kcal) || 0), 0);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function estimate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await estimateFoods(text.trim(), myFoods);
      setRows(res.items.map((est, i) => ({ key: i, est, on: true, name: est.name, meal: est.meal ?? meal, kcal: String(est.kcal) })));
      setMessage(res.message);
    } catch (e) {
      const code = e instanceof EstimateFailure ? e.code : "upstream";
      setErr(tx(`ai.err.${code}`, t("ai.err.upstream")));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr("");
    try {
      const saved = await addFoods(
        chosen.map((r) => ({
          log_date: date,
          meal: r.meal,
          food_ref: null,
          name: r.name.trim(),
          grams: r.est.grams,
          ...scaleEstimate(r.est, Number(r.kcal) || 0),
        })),
      );
      onSaved(saved);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  if (!rows) {
    return (
      <form className="stack" onSubmit={estimate}>
        <p className="hint">{t("ai.hint")}</p>
        <label>
          {t("ai.describe")}
          <textarea rows={4} autoFocus maxLength={2000} placeholder={t("ai.placeholder")} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {err && <p className="alert err">{err}</p>}
        <button className="btn primary block" disabled={busy || !text.trim()}>
          <Icon name="sparkles" size={16} /> {busy ? t("ai.thinking") : t("ai.estimate")}
        </button>
      </form>
    );
  }

  return (
    <div className="stack">
      <button type="button" className="link back" onClick={() => setRows(null)}>
        <Icon name="left" size={16} /> {t("ai.editText")}
      </button>
      {message && <p className="alert warn">{message}</p>}
      {rows.length > 0 && <p className="hint">{t("ai.review")}</p>}
      <ul className="ai-rows">
        {rows.map((r) => {
          const m = scaleEstimate(r.est, Number(r.kcal) || 0);
          const range = r.est.kcal_min === r.est.kcal_max ? "" : `${fmt(r.est.kcal_min)}–${fmt(r.est.kcal_max)} kcal`;
          return (
            <li key={r.key} className={r.on ? "ai-row" : "ai-row off"}>
              <input type="checkbox" checked={r.on} onChange={(e) => update(r.key, { on: e.target.checked })} aria-label={t("ai.include", { name: r.name })} />
              <div className="ai-main">
                <input className="ai-name" value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} aria-label={t("cf.name")} />
                <div className="ai-fields">
                  <select value={r.meal} onChange={(e) => update(r.key, { meal: e.target.value as Meal })} aria-label={t("fp.meal")}>
                    {MEALS.map((x) => (
                      <option key={x} value={x}>
                        {t(`meal.${x}`)}
                      </option>
                    ))}
                  </select>
                  <label className="ai-kcal">
                    <input type="number" inputMode="decimal" min="0" step="any" value={r.kcal} onChange={(e) => update(r.key, { kcal: e.target.value })} />
                    <span>kcal</span>
                  </label>
                  {range && <small className="muted">{range}</small>}
                </div>
                <small className="muted">
                  {r.est.grams ? `${fmt(r.est.grams)} g · ` : ""}
                  {t("macro.p")} {fmt(m.protein, 1)} · {t("macro.c")} {fmt(m.carb, 1)} · {t("macro.f")} {fmt(m.fat, 1)}
                  {r.est.matched && ` · ${t("ai.matched", { name: r.est.matched })}`}
                </small>
                {r.est.note && <small className="muted ai-note">{r.est.note}</small>}
              </div>
            </li>
          );
        })}
      </ul>
      {rows.length > 0 && (
        <div className="preview">
          <div>
            <span className="muted small">{t("ai.total", { n: chosen.length })}</span>
            <b className="big">{fmt(total)} kcal</b>
          </div>
        </div>
      )}
      {err && <p className="alert err">{err}</p>}
      <button type="button" className="btn primary block" disabled={busy || chosen.length === 0} onClick={save}>
        {t("ai.add", { n: chosen.length })}
      </button>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useT } from "../i18n";
import type { CustomFoodInput } from "../lib/api";
import type { CustomFood } from "../lib/types";

/** Form tạo / sửa "Món của tôi": giá trị theo 100 g hoặc theo 1 phần. */
export default function CustomFoodForm({
  initial,
  initialName = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: CustomFood;
  initialName?: string;
  submitLabel: string;
  onSubmit: (f: CustomFoodInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useT();
  const servings = t("cf.servings").split("|");
  const [name, setName] = useState(initial?.name ?? initialName);
  const [basis, setBasis] = useState<"100g" | "serving">(initial?.basis ?? "serving");
  const [serving, setServing] = useState(initial?.serving_name ?? servings[0]);
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : "");
  const [protein, setProtein] = useState(initial ? String(initial.protein) : "");
  const [carb, setCarb] = useState(initial ? String(initial.carb) : "");
  const [fat, setFat] = useState(initial ? String(initial.fat) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const unit = basis === "serving" ? `1 ${serving.trim() || servings[0]}` : "100 g";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onSubmit({
        name: name.trim(),
        basis,
        serving_name: basis === "serving" ? serving.trim() || servings[0] : null,
        kcal: Number(kcal),
        protein: Number(protein) || 0,
        carb: Number(carb) || 0,
        fat: Number(fat) || 0,
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
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder={t("cf.namePh")} />
      </label>

      <div>
        <span className="label">{t("cf.basis")}</span>
        <div className="seg">
          <button type="button" className={basis === "serving" ? "active" : ""} onClick={() => setBasis("serving")}>
            {t("cf.perServing")}
          </button>
          <button type="button" className={basis === "100g" ? "active" : ""} onClick={() => setBasis("100g")}>
            {t("cf.per100")}
          </button>
        </div>
        <p className="hint">{basis === "serving" ? t("cf.servingHint") : t("cf.per100Hint")}</p>
      </div>

      {basis === "serving" && (
        <div>
          <label>
            {t("cf.unitName")}
            <input value={serving} onChange={(e) => setServing(e.target.value)} maxLength={20} />
          </label>
          <div className="chips">
            {servings.map((s) => (
              <button type="button" key={s} className={serving === s ? "chip active" : "chip"} onClick={() => setServing(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <label>
        {t("cf.kcalPer", { unit })}
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
      <p className="hint">{t("cf.macroHint", { unit })}</p>

      {err && <p className="alert err">{err}</p>}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn secondary" onClick={onCancel}>
            {t("common.cancel")}
          </button>
        )}
        <button className="btn primary" disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

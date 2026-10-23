import { useState, type FormEvent } from "react";
import type { CustomFoodInput } from "../lib/api";
import type { CustomFood } from "../lib/types";

const SERVINGS = ["phần", "ổ", "chén", "tô", "ly", "gói", "cái", "hộp"];

/** Form tạo / sửa "Thực phẩm của tôi": giá trị theo 100 g hoặc theo 1 phần. */
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
  const [name, setName] = useState(initial?.name ?? initialName);
  const [basis, setBasis] = useState<"100g" | "serving">(initial?.basis ?? "serving");
  const [serving, setServing] = useState(initial?.serving_name ?? "phần");
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : "");
  const [protein, setProtein] = useState(initial ? String(initial.protein) : "");
  const [carb, setCarb] = useState(initial ? String(initial.carb) : "");
  const [fat, setFat] = useState(initial ? String(initial.fat) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const unit = basis === "serving" ? `1 ${serving.trim() || "phần"}` : "100 g";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await onSubmit({
        name: name.trim(),
        basis,
        serving_name: basis === "serving" ? serving.trim() || "phần" : null,
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
        Tên món
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Bánh mì chả cá cô Ba" />
      </label>

      <div>
        <span className="label">Giá trị dinh dưỡng tính theo</span>
        <div className="tabs">
          <button type="button" className={basis === "serving" ? "active" : ""} onClick={() => setBasis("serving")}>
            Theo phần
          </button>
          <button type="button" className={basis === "100g" ? "active" : ""} onClick={() => setBasis("100g")}>
            Trên 100 g
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>
          {basis === "serving"
            ? "Dùng cho món quán, đồ đóng gói: nhập tổng kcal của 1 phần (1 ổ, 1 tô, 1 ly…)."
            : "Dùng khi biết giá trị trên 100 g (bảng thành phần trên bao bì); khi ăn sẽ nhập số gram."}
        </p>
      </div>

      {basis === "serving" && (
        <label>
          Tên đơn vị
          <input value={serving} onChange={(e) => setServing(e.target.value)} maxLength={20} />
          <div className="chips">
            {SERVINGS.map((s) => (
              <button type="button" key={s} className={serving === s ? "chip active" : "chip"} onClick={() => setServing(s)}>
                {s}
              </button>
            ))}
          </div>
        </label>
      )}

      <label>
        kcal / {unit}
        <input type="number" inputMode="decimal" min="0" step="any" value={kcal} onChange={(e) => setKcal(e.target.value)} required />
      </label>
      <div className="row3">
        <label>
          Protein (g)
          <input type="number" inputMode="decimal" min="0" step="any" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </label>
        <label>
          Carb (g)
          <input type="number" inputMode="decimal" min="0" step="any" value={carb} onChange={(e) => setCarb(e.target.value)} />
        </label>
        <label>
          Fat (g)
          <input type="number" inputMode="decimal" min="0" step="any" value={fat} onChange={(e) => setFat(e.target.value)} />
        </label>
      </div>
      <p className="muted small">Protein, carb, fat tính trên {unit}; không biết có thể để trống.</p>

      {err && <p className="err">{err}</p>}
      <div className="row-between">
        {onCancel ? (
          <button type="button" className="secondary" onClick={onCancel}>
            Hủy
          </button>
        ) : (
          <span />
        )}
        <button className="primary" disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

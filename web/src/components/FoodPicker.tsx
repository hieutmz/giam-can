import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addFood, listCustomFoods } from "../lib/api";
import { portion } from "../lib/calc";
import { fmt } from "../lib/date";
import { FOODS, searchFoods } from "../lib/foods";
import { MEALS, type CustomFood, type FoodLog, type Meal } from "../lib/types";
import Modal from "./Modal";

type Item = { id: string; name: string; group?: string; kcal: number; protein: number; carb: number; fat: number };

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
  const [tab, setTab] = useState<"search" | "quick">("search");
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [grams, setGrams] = useState("100");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listCustomFoods().then(setCustom).catch(() => setCustom([]));
  }, []);

  const all: Item[] = useMemo(() => [...custom, ...FOODS], [custom]);
  const results = useMemo(() => searchFoods(all, query, 40), [all, query]);
  const g = Number(grams) || 0;
  const p = picked ? portion(picked, g) : null;

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
    if (!picked || !p || g <= 0) return;
    save({ log_date: date, meal, food_ref: picked.id, name: picked.name, grams: g, ...round(p) });
  }

  const mealSelect = (
    <label>
      Bữa
      <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
        {MEALS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Modal title="Thêm món ăn" onClose={onClose}>
      <div className="tabs">
        <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>
          Tìm thực phẩm
        </button>
        <button className={tab === "quick" ? "active" : ""} onClick={() => setTab("quick")}>
          Nhập nhanh kcal
        </button>
      </div>

      {tab === "search" && !picked && (
        <div className="stack">
          <input
            autoFocus
            placeholder={`Tìm trong ${fmt(all.length)} thực phẩm… (không cần gõ dấu)`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="pick-list">
            {results.map((f) => (
              <li key={f.id}>
                <button onClick={() => setPicked(f)}>
                  <span>
                    {f.name}
                    <small className="muted"> · {f.group}</small>
                  </span>
                  <span className="num muted">{fmt(f.kcal)} kcal</span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="muted pad">
                Không tìm thấy. Dùng tab <b>Nhập nhanh kcal</b> hoặc thêm vào <b>Thực phẩm của tôi</b>.
              </li>
            )}
          </ul>
          <p className="muted small">Giá trị tính trên 100 g.</p>
        </div>
      )}

      {tab === "search" && picked && p && (
        <form className="stack" onSubmit={addPicked}>
          <button type="button" className="link" onClick={() => setPicked(null)}>
            ← Chọn món khác
          </button>
          <div>
            <b>{picked.name}</b>
            <p className="muted small">
              100 g: {fmt(picked.kcal)} kcal · P {fmt(picked.protein, 1)} g · C {fmt(picked.carb, 1)} g · F{" "}
              {fmt(picked.fat, 1)} g
            </p>
          </div>
          <label>
            Khối lượng (g)
            <input type="number" inputMode="decimal" min="1" step="any" value={grams} onChange={(e) => setGrams(e.target.value)} autoFocus />
          </label>
          <div className="chips">
            {[50, 100, 150, 200, 250, 300].map((n) => (
              <button type="button" key={n} className={g === n ? "chip active" : "chip"} onClick={() => setGrams(String(n))}>
                {n} g
              </button>
            ))}
          </div>
          {mealSelect}
          <div className="preview">
            <div>
              <span className="muted small">Năng lượng</span>
              <b className="big">{fmt(p.kcal)} kcal</b>
            </div>
            <div className="macros">
              <span>P {fmt(p.protein, 1)} g</span>
              <span>C {fmt(p.carb, 1)} g</span>
              <span>F {fmt(p.fat, 1)} g</span>
            </div>
          </div>
          {err && <p className="err">{err}</p>}
          <button className="primary" disabled={busy || g <= 0}>
            Thêm vào nhật ký
          </button>
        </form>
      )}

      {tab === "quick" && <QuickAdd mealSelect={mealSelect} busy={busy} err={err} onSave={(r) => save({ log_date: date, meal, ...r })} />}
    </Modal>
  );
}

function QuickAdd({
  mealSelect,
  busy,
  err,
  onSave,
}: {
  mealSelect: JSX.Element;
  busy: boolean;
  err: string;
  onSave: (r: Pick<FoodLog, "name" | "kcal" | "protein" | "carb" | "fat" | "grams" | "food_ref">) => void;
}) {
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name: name.trim(),
          kcal: Number(kcal),
          protein: Number(protein) || 0,
          carb: Number(carb) || 0,
          fat: Number(fat) || 0,
          grams: null,
          food_ref: null,
        });
      }}
    >
      <p className="muted small">Dùng khi đã biết tổng kcal (ví dụ: trên bao bì, menu quán).</p>
      <label>
        Tên món
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Bánh mì chả cá" />
      </label>
      <label>
        Tổng kcal
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
      {mealSelect}
      {err && <p className="err">{err}</p>}
      <button className="primary" disabled={busy}>
        Thêm vào nhật ký
      </button>
    </form>
  );
}

const round = (p: { kcal: number; protein: number; carb: number; fat: number }) => ({
  kcal: Math.round(p.kcal * 10) / 10,
  protein: Math.round(p.protein * 10) / 10,
  carb: Math.round(p.carb * 10) / 10,
  fat: Math.round(p.fat * 10) / 10,
});

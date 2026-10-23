import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addCustomFood, addFood, listCustomFoods } from "../lib/api";
import { amountNutrition } from "../lib/calc";
import { fmt } from "../lib/date";
import { FOODS, searchFoods, unitLabel } from "../lib/foods";
import { MEALS, type CustomFood, type FoodLog, type Meal } from "../lib/types";
import CustomFoodForm from "./CustomFoodForm";
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
  const [tab, setTab] = useState<Tab>("search");
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Item | null>(null);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    listCustomFoods().then(setCustom).catch(() => setCustom([]));
  }, []);

  const mine = useMemo(() => searchFoods(custom, query, 50), [custom, query]);
  const system = useMemo(() => searchFoods(FOODS, query, 40), [query]);
  const isServing = picked?.basis === "serving";
  const a = Number(amount) || 0;
  const p = picked ? amountNutrition(picked, a) : null;

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
    save({
      log_date: date,
      meal,
      food_ref: picked.id,
      name: isServing ? `${picked.name} (${fmt(a, 2)} ${picked.serving_name || "phần"})` : picked.name,
      grams: isServing ? null : a,
      ...round(p),
    });
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

  const amountChips = isServing ? [0.5, 1, 1.5, 2, 3] : [50, 100, 150, 200, 250, 300];

  return (
    <Modal title="Thêm món ăn" onClose={onClose}>
      <div className="tabs">
        <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>
          Tìm món
        </button>
        <button className={tab === "quick" ? "active" : ""} onClick={() => setTab("quick")}>
          Nhập nhanh
        </button>
        <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>
          Tạo món mới
        </button>
      </div>

      {tab === "search" && !picked && (
        <div className="stack">
          <input
            autoFocus
            placeholder="Tìm món… (không cần gõ dấu)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="pick-scroll">
            <div className="pick-head">
              <span>Món của tôi</span>
              <button className="link small" onClick={() => setTab("create")}>
                + Tạo món
              </button>
            </div>
            <ul className="pick-list">
              {mine.map((f) => (
                <PickRow key={f.id} f={f} onPick={pick} />
              ))}
              {mine.length === 0 && (
                <li className="pad muted small">
                  {custom.length === 0 ? "Chưa có món nào của bạn." : `Không có món nào khớp “${query}”.`}
                </li>
              )}
            </ul>

            <div className="pick-head">
              <span>Thực phẩm hệ thống</span>
              <span className="muted small">trên 100 g</span>
            </div>
            <ul className="pick-list">
              {system.map((f) => (
                <PickRow key={f.id} f={f} onPick={pick} showGroup />
              ))}
              {system.length === 0 && (
                <li className="pad stack">
                  <span className="muted small">Không tìm thấy “{query}” trong hệ thống.</span>
                  <button className="secondary" onClick={() => setTab("create")}>
                    + Tạo món “{query}” trong Món của tôi
                  </button>
                </li>
              )}
            </ul>
          </div>
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
              {unitLabel(picked)}: {fmt(picked.kcal)} kcal · P {fmt(picked.protein, 1)} g · C {fmt(picked.carb, 1)} g · F{" "}
              {fmt(picked.fat, 1)} g
            </p>
          </div>
          <label>
            {isServing ? `Số ${picked.serving_name || "phần"}` : "Khối lượng (g)"}
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
                {isServing ? `${fmt(n, 1)} ${picked.serving_name || "phần"}` : `${n} g`}
              </button>
            ))}
          </div>
          {mealSelect}
          <Preview p={p} />
          {err && <p className="err">{err}</p>}
          <button className="primary" disabled={busy || a <= 0}>
            Thêm vào nhật ký
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
                const f = await addCustomFood({ ...r, basis: "serving", serving_name: "phần" });
                setCustom((xs) => [f, ...xs]);
              } catch (e) {
                setErr((e as Error).message);
                return;
              }
            }
            save({ log_date: date, meal, food_ref: null, grams: null, ...r });
          }}
        />
      )}

      {tab === "create" && (
        <>
          <p className="muted small">Món sẽ được lưu vào “Món của tôi” (chỉ tài khoản của bạn thấy), sau đó chọn lượng ăn.</p>
          <CustomFoodForm
            key={query}
            initialName={query}
            submitLabel="Lưu món"
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

function PickRow({ f, onPick, showGroup }: { f: Item; onPick: (f: Item) => void; showGroup?: boolean }) {
  return (
    <li>
      <button onClick={() => onPick(f)}>
        <span>
          {f.name}
          {showGroup && <small className="muted"> · {f.group}</small>}
        </span>
        <span className="num muted">
          {fmt(f.kcal)} kcal/{unitLabel(f)}
        </span>
      </button>
    </li>
  );
}

function Preview({ p }: { p: { kcal: number; protein: number; carb: number; fat: number } }) {
  return (
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
  onSave: (r: QuickRow, remember: boolean) => void;
}) {
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
        onSave(
          {
            name: name.trim(),
            kcal: Number(kcal),
            protein: Number(protein) || 0,
            carb: Number(carb) || 0,
            fat: Number(fat) || 0,
          },
          remember,
        );
      }}
    >
      <p className="muted small">Dùng khi đã biết tổng kcal của món (bao bì, menu quán).</p>
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
      <label className="check">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        Lưu vào “Món của tôi” để lần sau chọn nhanh (1 phần = số kcal trên)
      </label>
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

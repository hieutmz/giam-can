import { useEffect, useMemo, useState, type FormEvent } from "react";
import { addCustomFood, deleteCustomFood, listCustomFoods } from "../lib/api";
import { fmt } from "../lib/date";
import { FOOD_GROUPS, FOODS, searchFoods } from "../lib/foods";
import type { CustomFood } from "../lib/types";

export default function Foods() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  const reload = () => listCustomFoods().then(setCustom).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  const list = useMemo(() => {
    const base = group === "__mine" ? custom : group ? FOODS.filter((f) => f.group === group) : [...custom, ...FOODS];
    return searchFoods(base, query, 300);
  }, [query, group, custom]);

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>Thực phẩm</h1>
          <p className="muted">
            {fmt(FOODS.length)} thực phẩm · giá trị trên 100 g (đồ uống: 100 ml)
          </p>
        </div>
        <button className="primary sm" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Đóng" : "+ Thêm của tôi"}
        </button>
      </div>

      {showAdd && (
        <AddCustom
          onDone={() => {
            setShowAdd(false);
            reload();
          }}
        />
      )}
      {error && <p className="err">{error}</p>}

      <div className="filters">
        <input placeholder="Tìm (không cần gõ dấu)…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Tất cả nhóm</option>
          <option value="__mine">Thực phẩm của tôi ({custom.length})</option>
          {FOOD_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th className="num">kcal</th>
                <th className="num">Protein</th>
                <th className="num">Carb</th>
                <th className="num">Fat</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id}>
                  <td>
                    {f.name}
                    <br />
                    <small className="muted">{f.group}</small>
                  </td>
                  <td className="num">{fmt(Number(f.kcal))}</td>
                  <td className="num">{fmt(Number(f.protein), 1)}</td>
                  <td className="num">{fmt(Number(f.carb), 1)}</td>
                  <td className="num">{fmt(Number(f.fat), 1)}</td>
                  <td>
                    {f.id.startsWith("custom:") && (
                      <button
                        className="icon-btn danger"
                        aria-label={`Xóa ${f.name}`}
                        onClick={async () => {
                          if (!confirm(`Xóa "${f.name}"?`)) return;
                          await deleteCustomFood(f.id).catch((e) => setError(e.message));
                          reload();
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 300 && <p className="muted small">Hiển thị 300 kết quả đầu, hãy gõ để lọc thêm.</p>}
      </div>
    </div>
  );
}

function AddCustom({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", kcal: "", protein: "", carb: "", fat: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addCustomFood({
        name: f.name.trim(),
        kcal: Number(f.kcal),
        protein: Number(f.protein) || 0,
        carb: Number(f.carb) || 0,
        fat: Number(f.fat) || 0,
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Thêm thực phẩm của tôi</h2>
      <p className="muted small">Nhập giá trị trên 100 g (xem bảng thành phần trên bao bì).</p>
      <label>
        Tên
        <input value={f.name} onChange={set("name")} required />
      </label>
      <div className="row4">
        <label>
          kcal
          <input type="number" inputMode="decimal" min="0" step="any" value={f.kcal} onChange={set("kcal")} required />
        </label>
        <label>
          Protein
          <input type="number" inputMode="decimal" min="0" step="any" value={f.protein} onChange={set("protein")} />
        </label>
        <label>
          Carb
          <input type="number" inputMode="decimal" min="0" step="any" value={f.carb} onChange={set("carb")} />
        </label>
        <label>
          Fat
          <input type="number" inputMode="decimal" min="0" step="any" value={f.fat} onChange={set("fat")} />
        </label>
      </div>
      {err && <p className="err">{err}</p>}
      <button className="primary" disabled={busy}>
        Lưu
      </button>
    </form>
  );
}

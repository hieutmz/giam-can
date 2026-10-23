import { useEffect, useMemo, useState } from "react";
import CustomFoodForm from "../components/CustomFoodForm";
import Modal from "../components/Modal";
import { addCustomFood, deleteCustomFood, listCustomFoods, updateCustomFood } from "../lib/api";
import { fmt } from "../lib/date";
import { FOOD_GROUPS, FOODS, searchFoods, unitLabel } from "../lib/foods";
import type { CustomFood } from "../lib/types";

export default function Foods() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [editing, setEditing] = useState<CustomFood | "new" | null>(null);
  const [error, setError] = useState("");

  const reload = () => listCustomFoods().then(setCustom).catch((e) => setError(e.message));
  useEffect(() => {
    reload();
  }, []);

  const list = useMemo(() => {
    const base = group === "__mine" ? custom : group ? FOODS.filter((f) => f.group === group) : [...custom, ...FOODS];
    return searchFoods(base, query, 300);
  }, [query, group, custom]);

  async function remove(f: CustomFood) {
    if (!confirm(`Xóa "${f.name}" khỏi Thực phẩm của tôi?`)) return;
    await deleteCustomFood(f.id).catch((e) => setError(e.message));
    reload();
  }

  return (
    <div className="stack-lg">
      <div className="row-between">
        <div>
          <h1>Thực phẩm</h1>
          <p className="muted">
            {fmt(FOODS.length)} món có sẵn · {custom.length} món của tôi
          </p>
        </div>
        <button className="primary sm" onClick={() => setEditing("new")}>
          + Thêm món của tôi
        </button>
      </div>

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

      {group === "__mine" && custom.length === 0 && (
        <div className="card muted">
          Chưa có món nào. Bấm <b>+ Thêm món của tôi</b> để lưu các món hay ăn (vd: bánh mì chả cá 450 kcal/ổ), lần sau chỉ cần chọn.
        </div>
      )}

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
              {list.map((f) => {
                const mine = f.id.startsWith("custom:");
                return (
                  <tr key={f.id}>
                    <td>
                      {mine && <span className="badge">của tôi</span>}
                      {f.name}
                      <br />
                      <small className="muted">
                        {mine ? "Thực phẩm của tôi" : f.group} · trên {unitLabel(f)}
                      </small>
                    </td>
                    <td className="num">{fmt(Number(f.kcal))}</td>
                    <td className="num">{fmt(Number(f.protein), 1)}</td>
                    <td className="num">{fmt(Number(f.carb), 1)}</td>
                    <td className="num">{fmt(Number(f.fat), 1)}</td>
                    <td className="num">
                      {mine && (
                        <>
                          <button className="icon-btn" aria-label={`Sửa ${f.name}`} onClick={() => setEditing(f as CustomFood)}>
                            ✎
                          </button>
                          <button className="icon-btn danger" aria-label={`Xóa ${f.name}`} onClick={() => remove(f as CustomFood)}>
                            ✕
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 300 && <p className="muted small">Hiển thị 300 kết quả đầu, hãy gõ để lọc thêm.</p>}
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Thêm món của tôi" : "Sửa món"} onClose={() => setEditing(null)}>
          <CustomFoodForm
            initial={editing === "new" ? undefined : editing}
            initialName={editing === "new" ? query : ""}
            submitLabel={editing === "new" ? "Lưu món" : "Lưu thay đổi"}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              if (editing === "new") await addCustomFood(input);
              else await updateCustomFood(editing.id, input);
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

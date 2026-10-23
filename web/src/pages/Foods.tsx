import { useEffect, useMemo, useState } from "react";
import CustomFoodForm from "../components/CustomFoodForm";
import Modal from "../components/Modal";
import { addCustomFood, deleteCustomFood, listCustomFoods, updateCustomFood } from "../lib/api";
import { fmt } from "../lib/date";
import { FOOD_GROUPS, FOODS, searchFoods, unitLabel } from "../lib/foods";
import type { CustomFood, Food } from "../lib/types";

type Tab = "mine" | "system";

export default function Foods() {
  const [tab, setTab] = useState<Tab>("mine");
  const [custom, setCustom] = useState<CustomFood[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<CustomFood | "new" | null>(null);
  const [error, setError] = useState("");

  const reload = () =>
    listCustomFoods()
      .then(setCustom)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  useEffect(() => {
    reload();
  }, []);

  async function remove(f: CustomFood) {
    if (!confirm(`Xóa "${f.name}" khỏi Món của tôi?`)) return;
    await deleteCustomFood(f.id).catch((e) => setError(e.message));
    reload();
  }

  return (
    <div className="stack-lg">
      <h1>Thực phẩm</h1>

      <div className="tabs">
        <button className={tab === "mine" ? "active" : ""} onClick={() => setTab("mine")}>
          Món của tôi ({custom.length})
        </button>
        <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}>
          Thực phẩm hệ thống ({fmt(FOODS.length)})
        </button>
      </div>

      {error && <p className="err">{error}</p>}

      {tab === "mine" ? (
        <MyFoods
          foods={custom}
          loaded={loaded}
          onAdd={() => setEditing("new")}
          onEdit={(f) => setEditing(f)}
          onRemove={remove}
        />
      ) : (
        <SystemFoods />
      )}

      {editing && (
        <Modal title={editing === "new" ? "Thêm món của tôi" : "Sửa món"} onClose={() => setEditing(null)}>
          <CustomFoodForm
            initial={editing === "new" ? undefined : editing}
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

function MyFoods({
  foods,
  loaded,
  onAdd,
  onEdit,
  onRemove,
}: {
  foods: CustomFood[];
  loaded: boolean;
  onAdd: () => void;
  onEdit: (f: CustomFood) => void;
  onRemove: (f: CustomFood) => void;
}) {
  const [query, setQuery] = useState("");
  const list = useMemo(() => searchFoods(foods, query, 500), [foods, query]);

  return (
    <>
      <div className="row-between">
        <p className="muted small">Món bạn tự khai báo, chỉ tài khoản của bạn thấy.</p>
        <button className="primary sm" onClick={onAdd}>
          + Thêm món
        </button>
      </div>

      {loaded && foods.length === 0 ? (
        <div className="card stack">
          <p>Chưa có món nào.</p>
          <p className="muted small">
            Lưu các món hay ăn (vd: bánh mì chả cá 450 kcal/ổ, cà phê sữa quán quen 180 kcal/ly) để lần sau ghi nhật ký chỉ cần chọn.
          </p>
          <button className="primary" onClick={onAdd}>
            + Thêm món đầu tiên
          </button>
        </div>
      ) : (
        <>
          {foods.length > 8 && <input placeholder="Tìm trong món của tôi…" value={query} onChange={(e) => setQuery(e.target.value)} />}
          <div className="card">
            <FoodTable
              rows={list}
              actions={(f) => (
                <>
                  <button className="icon-btn" aria-label={`Sửa ${f.name}`} onClick={() => onEdit(f as CustomFood)}>
                    ✎
                  </button>
                  <button className="icon-btn danger" aria-label={`Xóa ${f.name}`} onClick={() => onRemove(f as CustomFood)}>
                    ✕
                  </button>
                </>
              )}
            />
          </div>
        </>
      )}
    </>
  );
}

function SystemFoods() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const list = useMemo(() => searchFoods(group ? FOODS.filter((f) => f.group === group) : FOODS, query, 300), [query, group]);

  return (
    <>
      <p className="muted small">Dữ liệu tham khảo có sẵn, giá trị trên 100 g (đồ uống: 100 ml). Không sửa được — muốn số liệu riêng, hãy thêm vào Món của tôi.</p>
      <div className="filters">
        <input placeholder="Tìm (không cần gõ dấu)…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Tất cả nhóm</option>
          {FOOD_GROUPS.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
      </div>
      <div className="card">
        <FoodTable rows={list} showGroup />
        {list.length === 300 && <p className="muted small">Hiển thị 300 kết quả đầu, hãy gõ để lọc thêm.</p>}
      </div>
    </>
  );
}

function FoodTable({
  rows,
  showGroup,
  actions,
}: {
  rows: (Food | CustomFood)[];
  showGroup?: boolean;
  actions?: (f: Food | CustomFood) => JSX.Element;
}) {
  if (rows.length === 0) return <p className="muted">Không có kết quả.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tên</th>
            <th className="num">kcal</th>
            <th className="num">Protein</th>
            <th className="num">Carb</th>
            <th className="num">Fat</th>
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <td>
                {f.name}
                <br />
                <small className="muted">
                  {showGroup ? `${f.group} · ` : ""}trên {unitLabel(f)}
                </small>
              </td>
              <td className="num">{fmt(Number(f.kcal))}</td>
              <td className="num">{fmt(Number(f.protein), 1)}</td>
              <td className="num">{fmt(Number(f.carb), 1)}</td>
              <td className="num">{fmt(Number(f.fat), 1)}</td>
              {actions && <td className="num">{actions(f)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

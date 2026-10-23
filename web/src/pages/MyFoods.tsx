import { useEffect, useMemo, useState } from "react";
import CustomFoodForm from "../components/CustomFoodForm";
import FoodTable from "../components/FoodTable";
import Modal from "../components/Modal";
import { addCustomFood, deleteCustomFood, listCustomFoods, updateCustomFood } from "../lib/api";
import { searchFoods } from "../lib/foods";
import type { CustomFood } from "../lib/types";

export default function MyFoods() {
  const [foods, setFoods] = useState<CustomFood[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<CustomFood | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const list = useMemo(() => searchFoods(foods, query, 1000), [foods, query]);

  const reload = () =>
    listCustomFoods()
      .then(setFoods)
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
      <div className="row-between">
        <div>
          <h1>Món của tôi</h1>
          <p className="muted small">Món bạn tự khai báo kcal, protein, carb, fat — chỉ tài khoản của bạn thấy.</p>
        </div>
        <button className="primary sm" onClick={() => setEditing("new")}>
          + Thêm món
        </button>
      </div>

      {error && <p className="err">{error}</p>}

      {!loaded ? (
        <p className="muted">Đang tải…</p>
      ) : foods.length === 0 ? (
        <div className="card stack">
          <p>Chưa có món nào.</p>
          <p className="muted small">
            Lưu các món hay ăn (vd: bánh mì chả cá 450 kcal/ổ, cà phê sữa quán quen 180 kcal/ly) để lần sau ghi nhật ký chỉ cần chọn.
          </p>
          <button className="primary" onClick={() => setEditing("new")}>
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
                  <button className="icon-btn" aria-label={`Sửa ${f.name}`} onClick={() => setEditing(f as CustomFood)}>
                    ✎
                  </button>
                  <button className="icon-btn danger" aria-label={`Xóa ${f.name}`} onClick={() => remove(f as CustomFood)}>
                    ✕
                  </button>
                </>
              )}
            />
          </div>
        </>
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

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FoodTable from "../components/FoodTable";
import { fmt } from "../lib/date";
import { FOOD_GROUPS, FOODS, searchFoods } from "../lib/foods";

/** Thực phẩm hệ thống: dữ liệu tham khảo có sẵn, chỉ xem. */
export default function Foods() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const list = useMemo(() => searchFoods(group ? FOODS.filter((f) => f.group === group) : FOODS, query, 300), [query, group]);

  return (
    <div className="stack-lg">
      <div>
        <h1>Thực phẩm</h1>
        <p className="muted small">
          {fmt(FOODS.length)} thực phẩm tham khảo, giá trị trên 100 g (đồ uống: 100 ml). Không sửa được — muốn số liệu riêng, hãy thêm vào{" "}
          <Link to="/mon-cua-toi">Món của tôi</Link>.
        </p>
      </div>
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
    </div>
  );
}

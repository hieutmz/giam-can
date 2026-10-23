import { fmt } from "../lib/date";
import { unitLabel } from "../lib/foods";
import type { CustomFood, Food } from "../lib/types";

export default function FoodTable({
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

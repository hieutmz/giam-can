import { usePrefs } from "../i18n";
import { groupLabel } from "../i18n/labels";
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
  const p = usePrefs();
  const { t } = p;
  if (rows.length === 0) return <p className="muted empty">{t("common.noResults")}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t("col.name")}</th>
            <th className="num">kcal</th>
            <th className="num">{t("macro.protein")}</th>
            <th className="num hide-sm">{t("macro.carb")}</th>
            <th className="num hide-sm">{t("macro.fat")}</th>
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <td>
                <span className="cell-title">{f.name}</span>
                <small className="muted">
                  {showGroup && f.group ? `${groupLabel(p, f.group)} · ` : ""}
                  {t("unit.per", { unit: unitLabel(f, t("unit.serving")) })}
                </small>
              </td>
              <td className="num strong">{fmt(Number(f.kcal))}</td>
              <td className="num">{fmt(Number(f.protein), 1)}</td>
              <td className="num hide-sm">{fmt(Number(f.carb), 1)}</td>
              <td className="num hide-sm">{fmt(Number(f.fat), 1)}</td>
              {actions && (
                <td className="num">
                  <div className="row-actions">{actions(f)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

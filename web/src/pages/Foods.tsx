import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FoodTable from "../components/FoodTable";
import Icon from "../components/Icon";
import { usePrefs } from "../i18n";
import { groupLabel } from "../i18n/labels";
import { fmt } from "../lib/date";
import { FOOD_GROUPS, FOODS, searchFoods } from "../lib/foods";

const LIMIT = 300;

/** Thực phẩm hệ thống: dữ liệu tham khảo có sẵn, chỉ xem. */
export default function Foods() {
  const prefs = usePrefs();
  const { t, lang } = prefs;
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const list = useMemo(() => searchFoods(group ? FOODS.filter((f) => f.group === group) : FOODS, query, LIMIT), [query, group]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t("foods.title")}</h1>
        <p className="muted">
          {t("foods.desc", { n: fmt(FOODS.length) })} <Link to="/mon-cua-toi">{t("nav.myFoods")}</Link>.
          {lang !== "vi" && <> {t("fp.systemNote")}</>}
        </p>
      </header>
      <div className="search">
        <Icon name="search" size={18} />
        <input placeholder={t("foods.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="chips scroll-x">
        <button className={group === "" ? "chip active" : "chip"} onClick={() => setGroup("")}>
          {t("foods.allGroups")}
        </button>
        {FOOD_GROUPS.map((g) => (
          <button key={g} className={group === g ? "chip active" : "chip"} onClick={() => setGroup(g)}>
            {groupLabel(prefs, g)}
          </button>
        ))}
      </div>
      <section className="card flush">
        <FoodTable rows={list} showGroup />
        {list.length === LIMIT && <p className="hint pad">{t("foods.limit", { n: LIMIT })}</p>}
      </section>
    </div>
  );
}

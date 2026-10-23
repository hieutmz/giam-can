import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Donut, Legend, Sparkline, TrendChart } from "../components/charts";
import Icon, { type IconName } from "../components/Icon";
import { usePrefs } from "../i18n";
import type { Key } from "../i18n/vi";
import { getRange } from "../lib/api";
import { effectiveBmr, summarizeDay, type DaySummary } from "../lib/calc";
import { addDays, daysBetween, fmt, fmtDate, today } from "../lib/date";
import { MEALS, type Meal, type Profile } from "../lib/types";

type RangeKey = "7" | "14" | "30" | "all" | "custom";
const RANGES: RangeKey[] = ["7", "14", "30", "all", "custom"];
type RangeData = Awaited<ReturnType<typeof getRange>>;
type Day = { date: string; s: DaySummary | null; steps: number | null };

/** Tóm tắt từng ngày trong [from, to]; ngày chưa nhập món ăn có s = null. */
function summarize(data: RangeData, profile: Profile, from: string, to: string): Day[] {
  const bmr = effectiveBmr(profile);
  const out: Day[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const foods = data.foods.filter((f) => f.log_date === d);
    const day = data.days.find((x) => x.log_date === d);
    const s =
      bmr && foods.length
        ? summarizeDay({
            bmr,
            activityFactor: Number(profile.activity_factor),
            weightKg: Number(day?.weight_kg ?? profile.weight_kg ?? 70),
            heightCm: Number(profile.height_cm ?? 165),
            foods,
            exercises: data.exercises.filter((e) => e.log_date === d),
            steps: day?.steps ?? null,
          })
        : null;
    out.push({ date: d, s, steps: day?.steps ?? null });
  }
  return out;
}

function metrics(days: Day[]) {
  const logged = days.filter((d) => d.s) as (Day & { s: DaySummary })[];
  const stepDays = days.filter((d) => d.steps != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    count: logged.length,
    deficit: logged.length ? logged.reduce((a, d) => a + d.s.deficit, 0) : null,
    intake: avg(logged.map((d) => d.s.intake)),
    protein: avg(logged.map((d) => d.s.protein)),
    steps: avg(stepDays.map((d) => Number(d.steps))),
  };
}

const pctChange = (cur: number | null, prev: number | null) => (cur == null || prev == null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);

export default function Overview() {
  const { profile } = useAuth();
  const prefs = usePrefs();
  const { t } = prefs;
  const [range, setRange] = useState<RangeKey>("14");
  const [custom, setCustom] = useState({ from: addDays(today(), -13), to: today() });
  const [data, setData] = useState<RangeData | null>(null);
  const [error, setError] = useState("");

  const end = range === "custom" ? custom.to : today();
  const start =
    range === "custom" ? custom.from : range === "all" ? (profile?.start_date ?? addDays(end, -29)) : addDays(end, -(Number(range) - 1));
  const len = daysBetween(start, end) + 1;
  const prevStart = addDays(start, -len);

  useEffect(() => {
    if (start > end) return;
    setData(null);
    getRange(prevStart, end)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [prevStart, end, start]);

  const view = useMemo(() => {
    if (!data || !profile) return null;
    const cur = summarize(data, profile, start, end);
    const prev = summarize(data, profile, prevStart, addDays(start, -1));
    const foods = data.foods.filter((f) => f.log_date >= start && f.log_date <= end);
    const byMeal = MEALS.map((m) => ({ meal: m, kcal: foods.filter((f) => f.meal === m).reduce((a, f) => a + Number(f.kcal), 0) }));
    const topMap = new Map<string, { name: string; times: number; kcal: number }>();
    for (const f of foods) {
      const key = f.name.replace(/\s*\(.*\)$/, "").trim();
      const row = topMap.get(key) ?? { name: key, times: 0, kcal: 0 };
      row.times += 1;
      row.kcal += Number(f.kcal);
      topMap.set(key, row);
    }
    const totalKcal = foods.reduce((a, f) => a + Number(f.kcal), 0);
    const macro = {
      p: foods.reduce((a, f) => a + Number(f.protein), 0) * 4,
      c: foods.reduce((a, f) => a + Number(f.carb), 0) * 4,
      f: foods.reduce((a, f) => a + Number(f.fat), 0) * 9,
    };
    return {
      cur,
      m: metrics(cur),
      pm: metrics(prev),
      byMeal,
      totalKcal,
      macro,
      top: [...topMap.values()].sort((a, b) => b.kcal - a.kcal).slice(0, 8),
    };
  }, [data, profile, start, end, prevStart]);

  if (!profile) return null;

  return (
    <div className="page wide">
      <header className="bg-overview page-head with-action">
        <div>
          <h1>{t("nav.overview")}</h1>
          <p className="muted">{t("ov.desc")}</p>
        </div>
        <div className="toolbar wrap">
          <div className="seg range-seg">
            {RANGES.map((r) => (
              <button key={r} className={range === r ? "active" : ""} onClick={() => setRange(r)}>
                {t(`range.${r}` as Key)}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="btn-group">
              <label className="date-field">
                <Icon name="calendar" size={16} />
                <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, from: e.target.value }))} />
              </label>
              <label className="date-field">
                <input type="date" value={custom.to} min={custom.from} max={today()} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, to: e.target.value }))} />
              </label>
            </div>
          )}
        </div>
      </header>

      <div className="range-meta">
        <Icon name="calendar" size={14} />
        <span>
          {fmtDate(start, "full")} → {fmtDate(end, "full")}
        </span>
        {view && <span className="muted">· {t("ov.days", { n: view.m.count })}</span>}
      </div>

      {error && <p className="alert err">{error}</p>}
      {!view && !error && <p className="muted empty">{t("common.loading")}</p>}

      {view && (
        <>
          <section className="kpi-grid">
            <Kpi
              icon="trend"
              label={t("ov.kDeficit")}
              value={view.m.deficit}
              unit="kcal"
              prev={view.pm.deficit}
              higherIsBetter
              spark={view.cur.map((d) => d.s?.deficit ?? null)}
              len={len}
            />
            <Kpi
              icon="utensils"
              label={t("ov.kIntake")}
              value={view.m.intake}
              unit="kcal"
              prev={view.pm.intake}
              higherIsBetter={false}
              spark={view.cur.map((d) => d.s?.intake ?? null)}
              len={len}
            />
            <Kpi
              icon="target"
              label={t("ov.kProtein")}
              value={view.m.protein}
              unit="g"
              prev={view.pm.protein}
              higherIsBetter
              spark={view.cur.map((d) => d.s?.protein ?? null)}
              len={len}
            />
            <Kpi
              icon="footprints"
              label={t("ov.kSteps")}
              value={view.m.steps}
              unit=""
              prev={view.pm.steps}
              higherIsBetter
              spark={view.cur.map((d) => d.steps)}
              len={len}
            />
          </section>

          {view.m.count === 0 ? (
            <section className="card empty-state">
              <span className="empty-icon">
                <Icon name="stats" size={24} />
              </span>
              <p className="muted">{t("ov.empty")}</p>
              <Link to="/nhat-ky" className="btn primary sm">
                {t("nav.diary")}
              </Link>
            </section>
          ) : (
            <>
              <div className="ov-grid">
                <section className="card">
                  <div className="card-head">
                    <div>
                      <h2>{t("ov.trend")}</h2>
                      <p className="hint">{t("ov.trendNote")}</p>
                    </div>
                    <Legend
                      items={[
                        { label: t("kpi.intake"), color: "var(--accent)" },
                        { label: t("kpi.burn"), color: "var(--burn)" },
                        { label: t("ov.target"), color: "var(--muted)", dashed: true },
                      ]}
                    />
                  </div>
                  <TrendChart
                    dates={view.cur.map((d) => d.date)}
                    series={[
                      { key: "intake", label: t("kpi.intake"), color: "var(--accent)", values: view.cur.map((d) => d.s?.intake ?? null) },
                      { key: "burn", label: t("kpi.burn"), color: "var(--burn)", values: view.cur.map((d) => d.s?.tdee ?? null) },
                      { key: "target", label: t("ov.target"), color: "var(--muted)", values: view.cur.map(() => profile.kcal_target), dashed: true },
                    ]}
                  />
                </section>

                <section className="card">
                  <div className="card-head">
                    <div>
                      <h2>{t("ov.macro")}</h2>
                      <p className="hint">{t("ov.macroNote")}</p>
                    </div>
                  </div>
                  <MacroBreakdown macro={view.macro} />
                </section>
              </div>

              <div className="ov-grid reverse">
                <section className="card flush">
                  <div className="card-head">
                    <h2>{t("ov.topFoods")}</h2>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("col.food")}</th>
                          <th className="num">{t("col.times")}</th>
                          <th className="num">kcal</th>
                          <th className="share-col">{t("col.share")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.top.map((r) => {
                          const share = view.totalKcal ? (r.kcal / view.totalKcal) * 100 : 0;
                          return (
                            <tr key={r.name}>
                              <td className="cell-title">{r.name}</td>
                              <td className="num">{r.times}</td>
                              <td className="num strong">{fmt(r.kcal)}</td>
                              <td className="share-col">
                                <div className="share">
                                  <div className="bar">
                                    <div style={{ width: `${share}%` }} />
                                  </div>
                                  <span className="num">{fmt(share, 1)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card">
                  <div className="card-head">
                    <h2>{t("ov.byMeal")}</h2>
                  </div>
                  <MealBars rows={view.byMeal} total={view.totalKcal} />
                </section>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  unit,
  prev,
  higherIsBetter,
  spark,
  len,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  unit: string;
  prev: number | null;
  higherIsBetter: boolean;
  spark: (number | null)[];
  len: number;
}) {
  const { t } = usePrefs();
  const change = pctChange(value, prev);
  const good = change == null ? null : change === 0 ? null : change > 0 === higherIsBetter;
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">
          <Icon name={icon} size={15} /> {label}
        </span>
        <Sparkline values={spark} color={good === false ? "var(--bad)" : "var(--accent)"} />
      </div>
      <div className="kpi-value">
        {fmt(value)}
        {unit && value != null && <small> {unit}</small>}
      </div>
      <div className="kpi-foot">
        {change == null ? (
          <span className="muted">{t("ov.noPrev")}</span>
        ) : (
          <>
            <span className={`change ${good == null ? "" : good ? "up" : "down"}`}>
              {change > 0 ? "▲" : change < 0 ? "▼" : "■"} {fmt(Math.abs(change), 1)}%
            </span>
            <span className="muted">{t("ov.vsPrev", { n: len })}</span>
          </>
        )}
      </div>
    </div>
  );
}

function MacroBreakdown({ macro }: { macro: { p: number; c: number; f: number } }) {
  const { t } = usePrefs();
  const total = macro.p + macro.c + macro.f;
  const parts = [
    { key: "p", label: t("macro.protein"), value: macro.p, color: "var(--p)" },
    { key: "c", label: t("macro.carb"), value: macro.c, color: "var(--c)" },
    { key: "f", label: t("macro.fat"), value: macro.f, color: "var(--f)" },
  ];
  return (
    <div className="macro-breakdown">
      <Donut parts={parts}>
        <span className="ring-value sm">{fmt(total)}</span>
        <span className="ring-label">kcal</span>
      </Donut>
      <ul className="legend-list">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="dot" style={{ background: p.color }} />
            <span>{p.label}</span>
            <b className="num">{total ? fmt((p.value / total) * 100, 0) : 0}%</b>
            <span className="num muted">{fmt(p.value)} kcal</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MealBars({ rows, total }: { rows: { meal: Meal; kcal: number }[]; total: number }) {
  const { t } = usePrefs();
  const max = Math.max(1, ...rows.map((r) => r.kcal));
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.meal}>
          <div className="hbar-top">
            <span>{t(`meal.${r.meal}`)}</span>
            <span className="num">
              <b>{fmt(r.kcal)}</b> <span className="muted">· {total ? fmt((r.kcal / total) * 100, 0) : 0}%</span>
            </span>
          </div>
          <div className="bar">
            <div style={{ width: `${(r.kcal / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

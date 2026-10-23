import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import Icon, { type IconName } from "../components/Icon";
import { usePrefs } from "../i18n";
import { getRange } from "../lib/api";
import { effectiveBmr, summarizeDay, type DaySummary } from "../lib/calc";
import { addDays, daysBetween, fmt, fmtDate, parseISODate, today } from "../lib/date";

type Row = { date: string; s: DaySummary; logged: boolean; weight: number | null; cumulative: number };

export default function History() {
  const { profile } = useAuth();
  const { t } = usePrefs();
  const [data, setData] = useState<Awaited<ReturnType<typeof getRange>> | null>(null);
  const [error, setError] = useState("");

  const start = profile?.start_date ?? today();
  const end = today();

  useEffect(() => {
    getRange(start, end)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [start, end]);

  const rows: Row[] = useMemo(() => {
    if (!data || !profile) return [];
    const bmr = effectiveBmr(profile);
    if (!bmr) return [];
    const out: Row[] = [];
    let cum = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const foods = data.foods.filter((f) => f.log_date === d);
      const exercises = data.exercises.filter((e) => e.log_date === d);
      const day = data.days.find((x) => x.log_date === d);
      const logged = foods.length > 0;
      if (!logged && !day && !exercises.length) continue;
      const s = summarizeDay({
        bmr,
        activityFactor: Number(profile.activity_factor),
        weightKg: Number(day?.weight_kg ?? profile.weight_kg ?? 70),
        heightCm: Number(profile.height_cm ?? 165),
        foods,
        exercises,
        steps: day?.steps ?? null,
      });
      // Chỉ cộng vào bộ đếm những ngày đã nhập món ăn
      if (logged) cum += s.deficit;
      out.push({ date: d, s, logged, weight: day?.weight_kg ?? null, cumulative: cum });
    }
    return out;
  }, [data, profile, start, end]);

  if (!profile) return null;
  if (error) return <p className="alert err">{error}</p>;
  if (!data) return <p className="muted empty">{t("common.loading")}</p>;

  const goal = profile.deficit_goal;
  const logged = rows.filter((r) => r.logged);
  const total = logged.at(-1)?.cumulative ?? 0;
  const avg = logged.length ? total / logged.length : 0;
  const pct = Math.max(0, (total / goal) * 100);
  let eta = "—";
  if (avg > 0) {
    const d = parseISODate(end);
    d.setDate(d.getDate() + Math.ceil((goal - total) / avg));
    eta = fmtDate(d, "full");
  }
  const chartRows = logged.slice(-30);
  const maxAbs = Math.max(1, ...chartRows.map((r) => Math.abs(r.s.deficit)));
  const weights = rows.filter((r) => r.weight != null) as (Row & { weight: number })[];

  return (
    <div className="page">
      <header className="page-head">
        <h1>{t("st.title")}</h1>
        <p className="muted">
          {t("st.subtitle", {
            date: fmtDate(start, "full"),
            days: daysBetween(start, end) + 1,
            goal: fmt(goal),
            kg: fmt(goal / 7700, 1),
          })}
        </p>
      </header>

      <section className="tiles">
        <Tile icon="target" tone="good" label={t("st.accum")} value={fmt(total)} note={t("st.pctGoal", { pct: fmt(pct, 2) })} />
        <Tile icon="flame" label={t("st.remain")} value={fmt(Math.max(0, goal - total))} note={t("st.remainKg", { kg: fmt(Math.max(0, goal - total) / 7700, 1) })} />
        <Tile icon="trend" label={t("st.avg")} value={fmt(avg)} note={t("st.daysLogged", { n: logged.length })} />
        <Tile icon="calendar" label={t("st.eta")} value={eta} note={t("st.etaNote")} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{t("st.progress")}</h2>
          <span className="pct-badge">{fmt(pct, 2)}%</span>
        </div>
        <div className="bar lg">
          <div style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="row-between small muted" style={{ marginTop: 8 }}>
          <span>
            {fmt(total)} / {fmt(goal)} kcal
          </span>
          <span>≈ {fmt(Math.max(0, total) / 7700, 2)} kg</span>
        </div>
      </section>

      {chartRows.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>{t("st.chart")}</h2>
          </div>
          <div className="chart">
            {chartRows.map((r) => {
              const neg = r.s.deficit < 0;
              return (
                <Link key={r.date} to={`/ngay/${r.date}`} className="col" title={`${fmtDate(r.date, "full")}: ${fmt(r.s.deficit)} kcal`}>
                  <div className="bar-area">
                    <div className={neg ? "b neg" : "b"} style={{ height: `${Math.max(3, (Math.abs(r.s.deficit) / maxAbs) * 100)}%` }}>
                      <span className="t">{fmt(r.s.deficit)}</span>
                    </div>
                  </div>
                  <span className="x">{fmtDate(r.date, "short")}</span>
                </Link>
              );
            })}
          </div>
          <p className="hint">{t("st.chartNote")}</p>
        </section>
      )}

      {weights.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>
              <Icon name="scale" size={18} /> {t("st.weight")}
            </h2>
            <span className="muted small">
              {weights.length > 1 &&
                t("st.weightChange", {
                  d: `${weights.at(-1)!.weight - weights[0].weight > 0 ? "+" : ""}${fmt(weights.at(-1)!.weight - weights[0].weight, 1)}`,
                })}
            </span>
          </div>
          <WeightChart points={weights.map((w) => ({ date: w.date, kg: Number(w.weight) }))} />
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>{t("st.days")}</h2>
        </div>
        {rows.length === 0 ? (
          <p className="muted empty">{t("st.empty")}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("col.date")}</th>
                  <th className="num">{t("col.intake")}</th>
                  <th className="num hide-sm">{t("col.burn")}</th>
                  <th className="num">{t("col.deficit")}</th>
                  <th className="num hide-md">{t("col.protein")}</th>
                  <th className="num">{t("col.cum")}</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.date}>
                    <td>
                      <Link to={`/ngay/${r.date}`} className="cell-title">
                        {fmtDate(r.date, "short")}
                      </Link>
                      <small className="muted">{fmtDate(r.date, "weekday")}</small>
                    </td>
                    <td className="num">{r.logged ? fmt(r.s.intake) : <span className="muted">{t("st.notLogged")}</span>}</td>
                    <td className="num hide-sm">{fmt(r.s.tdee)}</td>
                    <td className="num">
                      {r.logged ? <span className={`delta ${r.s.deficit >= 0 ? "good" : "bad"}`}>{fmt(r.s.deficit)}</span> : "—"}
                    </td>
                    <td className="num hide-md">{r.logged ? `${fmt(r.s.protein)} g` : "—"}</td>
                    <td className="num strong">{fmt(r.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ icon, label, value, note, tone }: { icon: IconName; label: string; value: string; note: string; tone?: "good" }) {
  return (
    <div className={`tile ${tone ?? ""}`}>
      <span className="tile-icon">
        <Icon name={icon} size={18} />
      </span>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      <div className="tile-note">{note}</div>
    </div>
  );
}

/** Biểu đồ đường cân nặng (SVG co giãn theo chiều ngang). */
function WeightChart({ points }: { points: { date: string; kg: number }[] }) {
  const W = 600;
  const H = 180;
  const pad = { l: 36, r: 12, t: 14, b: 26 };
  const kgs = points.map((p) => p.kg);
  const min = Math.floor(Math.min(...kgs) - 0.5);
  const max = Math.ceil(Math.max(...kgs) + 0.5);
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (kg: number) => pad.t + ((max - kg) / (max - min || 1)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const ticks = [min, (min + max) / 2, max];
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="weight chart">
      <defs>
        <linearGradient id="wfill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} className="grid" />
          <text x={pad.l - 6} y={y(tk) + 4} textAnchor="end" className="axis">
            {fmt(tk, 1)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#wfill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(p.kg)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2">
            <title>
              {fmtDate(p.date, "full")}: {fmt(p.kg, 1)} kg
            </title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 6} textAnchor="middle" className="axis">
              {fmtDate(p.date, "short")}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

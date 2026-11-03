import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Legend, MetricChart } from "../components/charts";
import Icon from "../components/Icon";
import Tile from "../components/Tile";
import WeekReview from "../components/WeekReview";
import { usePrefs } from "../i18n";
import { getRange } from "../lib/api";
import { dayDeficit, effectiveBmr, summarizeDay, type DaySummary } from "../lib/calc";
import { addDays, daysBetween, fmt, fmtDate, fmtSigned, parseISODate, today } from "../lib/date";
import { activityById } from "../lib/exercises";
import { ADAPTIVE, adaptiveTdee, weightTrend, type AdaptiveTdee, type DayFacts } from "../lib/progress";

type Row = {
  date: string;
  s: DaySummary;
  logged: boolean;
  hasFood: boolean;
  fixed: boolean;
  deficit: number;
  weight: number | null;
  cumulative: number;
  gym: boolean;
  steps: number | null;
  water: number | null;
  sleep: number | null;
};

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
      const fixed = day?.deficit_override != null;
      const logged = foods.length > 0 || fixed;
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
      // Chỉ cộng vào bộ đếm những ngày đã nhập món ăn hoặc đã tự chốt số thâm hụt
      const deficit = dayDeficit(s, day?.deficit_override);
      if (logged) cum += deficit;
      out.push({
        date: d,
        s,
        logged,
        hasFood: foods.length > 0,
        fixed,
        deficit,
        weight: day?.weight_kg ?? null,
        cumulative: cum,
        gym: exercises.some((e) => activityById(e.activity)?.group === "gym"),
        steps: day?.steps ?? null,
        water: day?.water_ml ?? null,
        sleep: day?.sleep_hours == null ? null : Number(day.sleep_hours),
      });
    }
    return out;
  }, [data, profile, start, end]);

  const trend = useMemo(() => weightTrend(rows.flatMap((r) => (r.weight == null ? [] : [{ date: r.date, kg: Number(r.weight) }]))), [rows]);
  const facts: DayFacts[] = useMemo(
    () =>
      rows.map((r) => ({
        date: r.date,
        hasFood: r.hasFood,
        intake: r.s.intake,
        protein: r.s.protein,
        deficit: r.logged ? r.deficit : null,
        gym: r.gym,
        steps: r.steps,
        water: r.water,
        sleep: r.sleep,
      })),
    [rows],
  );
  const targets = useMemo(
    () => ({
      protein: profile?.protein_target ?? 0,
      steps: profile?.steps_target,
      water: profile?.water_target_ml,
      sleep: profile?.sleep_target == null ? null : Number(profile.sleep_target),
    }),
    [profile],
  );

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
  const maxAbs = Math.max(1, ...chartRows.map((r) => Math.abs(r.deficit)));
  const adaptive = adaptiveTdee(
    trend,
    rows.filter((r) => r.hasFood).map((r) => ({ date: r.date, intake: r.s.intake, formulaTdee: r.s.tdee })),
    effectiveBmr(profile) ?? 0,
  );

  return (
    <div className="page">
      <header className="bg-stats page-head">
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

      <WeekReview days={facts} trend={trend} start={start} targets={targets} />

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
              const neg = r.deficit < 0;
              return (
                <Link key={r.date} to={`/ngay/${r.date}`} className="col" title={`${fmtDate(r.date, "full")}: ${fmt(r.deficit)} kcal`}>
                  <div className="bar-area">
                    <div className={neg ? "b neg" : "b"} style={{ height: `${Math.max(3, (Math.abs(r.deficit) / maxAbs) * 100)}%` }}>
                      <span className="t">{fmt(r.deficit)}</span>
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

      <section className="card">
        <div className="card-head">
          <h2>
            <Icon name="scale" size={18} /> {t("st.weight")}
          </h2>
          <Link to="/co-the" className="link small">
            {t("st.bodyLink")}
          </Link>
        </div>
        {trend.length > 0 ? (
          <>
            <div className="row-between small muted">
              <span>{t("st.trendNow", { kg: fmt(trend.at(-1)!.trend, 1) })}</span>
              {trend.length > 1 && <span>{t("st.weightChange", { d: fmtSigned(trend.at(-1)!.trend - trend[0].trend) })}</span>}
            </div>
            <Legend
              items={[
                { label: t("st.trendLine"), color: "var(--accent)" },
                { label: t("st.rawPoints"), color: "var(--muted)" },
              ]}
            />
            <MetricChart points={trend.map((p) => ({ date: p.date, value: p.kg, trend: p.trend }))} unit="kg" label={t("st.weight")} />
          </>
        ) : (
          <p className="muted small">{t("st.noWeight")}</p>
        )}
        <AdaptiveBox result={adaptive} />
      </section>

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
                    <td className="num">{r.hasFood ? fmt(r.s.intake) : <span className="muted">{t("st.notLogged")}</span>}</td>
                    <td className="num hide-sm">{fmt(r.s.tdee)}</td>
                    <td className="num">
                      {r.logged ? <span className={`delta ${r.deficit >= 0 ? "good" : "bad"}`}>{fmt(r.deficit)}</span> : "—"}
                      {r.fixed && <small className="muted">{t("st.fixed")}</small>}
                    </td>
                    <td className="num hide-md">{r.hasFood ? `${fmt(r.s.protein)} g` : "—"}</td>
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

/** TDEE suy từ cân nặng và kcal nạp thực tế, so với TDEE theo công thức. */
function AdaptiveBox({ result: r }: { result: AdaptiveTdee }) {
  const { t } = usePrefs();
  if (!r.ready) {
    const parts = [
      r.needWeighIns ? t("ad.needWeigh", { n: r.needWeighIns }) : null,
      r.needIntakeDays ? t("ad.needDays", { n: r.needIntakeDays }) : null,
      r.needSpanDays ? t("ad.needSpan", { n: r.needSpanDays }) : null,
    ].filter(Boolean);
    return (
      <div className="adaptive">
        <b>{t("ad.title")}</b>
        <p className="muted small">{t("ad.need", { items: parts.join(", ") })}</p>
      </div>
    );
  }
  const gap = r.formulaTdee - r.tdee;
  return (
    <div className="adaptive">
      <b>{t("ad.title")}</b>
      <div className="adaptive-values">
        <div>
          <span className="muted small">{t("ad.real")}</span>
          <b className="big">{fmt(r.tdee)}</b>
        </div>
        <div>
          <span className="muted small">{t("ad.formula")}</span>
          <b className="big muted">{fmt(r.formulaTdee)}</b>
        </div>
        <div>
          <span className="muted small">{t("ad.realDeficit")}</span>
          <b className="big">{fmt(r.realDeficit)}</b>
        </div>
      </div>
      <p className="muted small">
        {t(gap >= 0 ? "ad.formulaHigh" : "ad.formulaLow", { n: fmt(Math.abs(gap)) })}{" "}
        {t("ad.basis", { kg: fmtSigned(r.kgPerWeek, 2), w: r.weighIns, d: r.intakeDays, n: ADAPTIVE.windowDays })}
      </p>
    </div>
  );
}

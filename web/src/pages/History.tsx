import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Legend, MetricChart } from "../components/charts";
import Icon from "../components/Icon";
import Tile from "../components/Tile";
import WeekReview from "../components/WeekReview";
import { usePrefs } from "../i18n";
import { getRange } from "../lib/api";
import { effectiveBmr } from "../lib/calc";
import { counter, dayRows, intakeDays, toFacts, weightPoints } from "../lib/days";
import { daysBetween, fmt, fmtDate, fmtSigned, today } from "../lib/date";
import { ADAPTIVE, adaptiveTdee, weightTrend, type AdaptiveTdee } from "../lib/progress";

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

  const rows = useMemo(() => (data && profile ? dayRows(data, profile, start, end) : []), [data, profile, start, end]);
  const trend = useMemo(() => weightTrend(weightPoints(rows)), [rows]);
  const facts = useMemo(() => toFacts(rows), [rows]);
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
  const { total, avg, pct, eta: etaDate } = counter(rows, goal, end);
  const eta = etaDate ? fmtDate(etaDate, "full") : "—";
  const chartRows = logged.slice(-30);
  const maxAbs = Math.max(1, ...chartRows.map((r) => Math.abs(r.deficit)));
  const adaptive = adaptiveTdee(trend, intakeDays(rows), effectiveBmr(profile) ?? 0);

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
          <div className="toolbar">
            <Link to="/ke-hoach" className="link small">
              {t("pl.link")}
            </Link>
            <span className="pct-badge">{fmt(pct, 2)}%</span>
          </div>
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

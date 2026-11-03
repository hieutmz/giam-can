import { useMemo, useState } from "react";
import { usePrefs } from "../i18n";
import { addDays, fmt, fmtDate, fmtSigned, today } from "../lib/date";
import { weekStart, weekSummary, type DayFacts, type TrendPoint, type WeekTargets } from "../lib/progress";
import Icon from "./Icon";

/** Tổng kết theo tuần (Thứ Hai đến Chủ nhật), kèm so sánh với tuần trước. */
export default function WeekReview({ days, trend, start, targets }: { days: DayFacts[]; trend: TrendPoint[]; start: string; targets: WeekTargets }) {
  const { t } = usePrefs();
  const current = weekStart(today());
  const first = weekStart(start);
  const [from, setFrom] = useState(current);

  const { w, prev } = useMemo(() => {
    const at = (f: string) => weekSummary({ days, trend, from: f, today: today(), targets });
    return { w: at(from), prev: at(addDays(from, -7)) };
  }, [days, trend, from, targets]);

  const vs = (n: number | null, digits = 0) => (n == null ? t("wk.noPrev") : t("wk.prev", { n: fmt(n, digits) }));
  const hit = (n: number | null, days: number) => (n == null ? null : t("wk.hit", { n, days }));

  const cells = [
    {
      label: t("wk.deficit"),
      value: fmt(w.deficitAvg),
      unit: t("wk.perDay"),
      note: w.deficitTotal == null ? vs(prev.deficitAvg) : `${t("wk.total", { n: fmt(w.deficitTotal) })} · ${vs(prev.deficitAvg)}`,
      tone: w.deficitAvg == null ? "" : w.deficitAvg >= 0 ? "good" : "bad",
    },
    { label: t("wk.intake"), value: fmt(w.intakeAvg), unit: "kcal", note: vs(prev.intakeAvg) },
    { label: t("macro.protein"), value: fmt(w.proteinAvg), unit: "g", note: hit(w.proteinHit, w.elapsed) ?? vs(prev.proteinAvg) },
    { label: t("wk.gym"), value: String(w.gymDays), unit: t("wk.sessions"), note: t("wk.prev", { n: prev.gymDays }) },
    { label: t("wk.logged"), value: `${w.loggedDays}/${w.elapsed}`, unit: t("wk.daysUnit"), note: w.missedDays ? t("wk.missed", { n: w.missedDays }) : t("wk.noMissed") },
    {
      label: t("wk.weight"),
      value: fmtSigned(w.weightChange),
      unit: "kg",
      note: w.weightChange == null ? t("wk.needWeigh") : t("wk.weighIns", { n: w.weighIns }),
      tone: w.weightChange == null ? "" : w.weightChange <= 0 ? "good" : "bad",
    },
    { label: t("wk.steps"), value: fmt(w.stepsAvg), unit: t("wk.stepsUnit"), note: hit(w.stepsHit, w.elapsed) ?? vs(prev.stepsAvg) },
    { label: t("wk.water"), value: fmt(w.waterAvg), unit: "ml", note: hit(w.waterHit, w.elapsed) ?? vs(prev.waterAvg) },
    { label: t("wk.sleep"), value: fmt(w.sleepAvg, 1), unit: t("wk.hours"), note: hit(w.sleepHit, w.elapsed) ?? vs(prev.sleepAvg, 1) },
  ];

  return (
    <section className="card">
      <div className="card-head">
        <h2>{t("wk.title")}</h2>
        <div className="btn-group week-nav">
          <button className="btn secondary sm icon-only" disabled={from <= first} onClick={() => setFrom(addDays(from, -7))} aria-label={t("wk.prevWeek")}>
            <Icon name="left" size={16} />
          </button>
          <span className="small">
            {fmtDate(w.from, "short")} – {fmtDate(w.to, "short")}
          </span>
          <button className="btn secondary sm icon-only" disabled={from >= current} onClick={() => setFrom(addDays(from, 7))} aria-label={t("wk.nextWeek")}>
            <Icon name="right" size={16} />
          </button>
        </div>
      </div>
      <div className="week-grid">
        {cells.map((c) => (
          <div key={c.label} className="week-cell">
            <div className="stat-label">{c.label}</div>
            <div className={`week-value ${c.tone ?? ""}`}>
              {c.value} <small>{c.unit}</small>
            </div>
            <div className="tile-note">{c.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { usePrefs } from "../i18n";
import { exerciseLabel } from "../i18n/labels";
import { ApiFailure, reviewDay } from "../lib/ai";
import { getDayReview, getRange, listStrengthSetsOn, saveDayReview } from "../lib/api";
import type { DaySummary } from "../lib/calc";
import { fmt, fmtDate } from "../lib/date";
import { dayRows } from "../lib/days";
import { isStale, reviewInput, snapshotOf } from "../lib/review";
import type { DayLog, DayReview, ExerciseLog, FoodLog, Profile } from "../lib/types";
import Icon from "./Icon";

/** "Tổng kết và đánh giá" cuối ngày: số liệu do app tính, phần nhận xét do AI viết; lưu lại để xem lần sau. */
export default function DayReviewCard({
  date,
  profile,
  bmr,
  s,
  day,
  foods,
  exercises,
}: {
  date: string;
  profile: Profile;
  bmr: number;
  s: DaySummary;
  day: DayLog | null;
  foods: FoodLog[];
  exercises: ExerciseLog[];
}) {
  const prefs = usePrefs();
  const { t, tx, lang } = prefs;
  const [review, setReview] = useState<DayReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setReview(null);
    setErr("");
    // Chưa chạy migration 006 thì bảng chưa có: coi như chưa có bản đánh giá
    getDayReview(date)
      .then(setReview)
      .catch(() => setReview(null));
  }, [date]);

  async function run() {
    setBusy(true);
    setErr("");
    try {
      const [range, strength] = await Promise.all([
        getRange(profile.start_date, date),
        listStrengthSetsOn(date).catch(() => []),
      ]);
      const input = reviewInput({
        date,
        lang,
        profile,
        bmr,
        s,
        day,
        foods,
        exercises: exercises.map((e) => ({ ...e, label: exerciseLabel(prefs, e) })),
        strength,
        rows: dayRows(range, profile, profile.start_date, date),
      });
      const text = await reviewDay(input);
      const content = { ...text, snapshot: snapshotOf(input) };
      try {
        setReview(await saveDayReview(date, content));
      } catch (e) {
        setReview({ log_date: date, review: content, created_at: new Date().toISOString() });
        setErr(t("rv.notSaved", { msg: (e as Error).message }));
      }
    } catch (e) {
      setErr(e instanceof ApiFailure ? tx(`ai.err.${e.code}`, t("ai.err.upstream")) : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const r = review?.review;
  const snap = r?.snapshot;
  const runLabel = busy ? t("rv.thinking") : t(r ? "rv.rerun" : "rv.run");

  return (
    <section className="card review-card">
      <div className="card-head">
        <h2>
          <Icon name="sparkles" size={18} /> {t("rv.title")}
        </h2>
        {review && <small className="muted">{t("rv.at", { time: new Date(review.created_at).toLocaleString() })}</small>}
      </div>
      {!r ? (
        <div className="stack">
          <p className="muted small">{t("rv.desc")}</p>
          <button className="btn primary" onClick={run} disabled={busy}>
            <Icon name="sparkles" size={16} /> {runLabel}
          </button>
        </div>
      ) : (
        <div className="stack">
          {snap && (
            <div className="week-grid">
              <Cell label={t("rv.dayDeficit")} value={snap.counted ? fmt(snap.deficit) : "—"} unit="kcal" tone={!snap.counted ? "" : snap.deficit >= 0 ? "good" : "bad"} />
              <Cell label={t("rv.counter")} value={fmt(snap.counter.total)} unit={`/ ${fmt(snap.counter.goal)}`} note={`${fmt(snap.counter.pct, 1)}%`} />
              <Cell label={t("st.remain")} value={fmt(snap.counter.remaining)} unit="kcal" note={t("st.remainKg", { kg: fmt(snap.counter.remaining / 7700, 1) })} />
              <Cell
                label={t("st.eta")}
                value={snap.counter.eta ? fmtDate(snap.counter.eta, "full") : "—"}
                note={t("rv.avg", { n: fmt(snap.counter.avg), d: snap.counter.logged_days })}
              />
            </div>
          )}
          <p className="review-headline">{r.headline}</p>
          <ul className="review-items">
            {r.items.map((it) => (
              <li key={it.area} className={it.status}>
                <Icon name={it.status === "good" ? "check" : "alert"} size={16} />
                <div>
                  <b>{t(`rv.area.${it.area}`)}</b> {it.text}
                </div>
              </li>
            ))}
          </ul>
          {r.tomorrow.length > 0 && (
            <div>
              <b>{t("rv.tomorrow")}</b>
              <ul className="review-tomorrow">
                {r.tomorrow.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          {snap && isStale(snap, s.intake, s.tdee) && <p className="alert warn">{t("rv.stale")}</p>}
          <button className="btn secondary sm" onClick={run} disabled={busy}>
            <Icon name="sparkles" size={16} /> {runLabel}
          </button>
        </div>
      )}
      {err && <p className="alert err">{err}</p>}
    </section>
  );
}

function Cell({ label, value, unit, note, tone }: { label: string; value: string; unit?: string; note?: string; tone?: string }) {
  return (
    <div className="week-cell">
      <div className="stat-label">{label}</div>
      <div className={`week-value ${tone ?? ""}`}>
        {value} {unit && <small>{unit}</small>}
      </div>
      {note && <div className="tile-note">{note}</div>}
    </div>
  );
}

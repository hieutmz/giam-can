import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import Tile from "../components/Tile";
import { useT } from "../i18n";
import { getRange, listMeasurements, listStrengthSets, saveProfile } from "../lib/api";
import { effectiveBmr } from "../lib/calc";
import { dayRows, intakeDays, weightPoints, type RangeData } from "../lib/days";
import { addDays, fmt, fmtDate, fmtSigned, today } from "../lib/date";
import { planReview, type PlanReview } from "../lib/plan";
import { adaptiveTdee, KCAL_PER_KG, weightTrend } from "../lib/progress";
import type { BodyMeasurement, Profile, StrengthSet } from "../lib/types";

/** TDEE thực tế cần ~28 ngày cân gần nhất, nên tải thêm nếu kỳ kế hoạch ngắn hơn */
const LOOKBACK_DAYS = 35;

export default function Plan() {
  const t = useT();
  const { profile, refreshProfile } = useAuth();
  const [data, setData] = useState<RangeData | null>(null);
  const [body, setBody] = useState<BodyMeasurement[]>([]);
  const [strength, setStrength] = useState<StrengthSet[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const end = today();
  const start = profile?.plan_start ?? profile?.start_date ?? end;
  const lookback = addDays(end, -LOOKBACK_DAYS);
  const from = start < lookback ? start : lookback;

  useEffect(() => {
    Promise.all([getRange(from, end), listMeasurements().catch(() => []), listStrengthSets().catch(() => [])])
      .then(([range, m, s]) => {
        setData(range);
        setBody(m);
        setStrength(s);
      })
      .catch((e) => setError(e.message));
  }, [from, end]);

  const bmr = profile ? effectiveBmr(profile) : null;
  const review = useMemo(() => {
    if (!data || !profile || !bmr || !profile.plan_end) return null;
    const rows = dayRows(data, profile, from, end);
    const trend = weightTrend(weightPoints(rows));
    return planReview({
      start,
      end: profile.plan_end,
      today: end,
      rows,
      trend,
      body,
      strength,
      targetKg: profile.fat_loss_target_kg == null ? null : Number(profile.fat_loss_target_kg),
      proteinTarget: profile.protein_target,
      adaptive: adaptiveTdee(trend, intakeDays(rows), bmr),
      bmr,
    });
  }, [data, profile, bmr, body, strength, from, start, end]);

  if (!profile) return null;

  async function applyKcal(kcal: number) {
    setBusy(true);
    try {
      await saveProfile({ id: profile!.id, kcal_target: kcal });
      await refreshProfile();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="bg-stats page-head with-action">
        <div>
          <h1>{t("pl.title")}</h1>
          <p className="muted">
            {review
              ? t("pl.range", { from: fmtDate(review.start, "full"), to: fmtDate(review.end, "full"), day: review.elapsed, total: review.totalDays, left: review.daysLeft })
              : t("pl.desc")}
          </p>
        </div>
        <button className="btn secondary" onClick={() => setEditing(true)}>
          <Icon name="pencil" size={16} /> {t("pl.edit")}
        </button>
      </header>

      {error && <p className="alert err">{error}</p>}

      {!profile.plan_end ? (
        <section className="card empty-state">
          <span className="empty-icon">
            <Icon name="target" size={28} />
          </span>
          <h2>{t("pl.empty")}</h2>
          <p className="muted">{t("pl.emptyHint")}</p>
          <button className="btn primary" onClick={() => setEditing(true)}>
            <Icon name="plus" size={18} /> {t("pl.set")}
          </button>
        </section>
      ) : !review ? (
        <p className="muted empty">{t("common.loading")}</p>
      ) : (
        <PlanBody r={review} profile={profile} busy={busy} onApply={applyKcal} />
      )}

      {editing && (
        <PlanForm
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await refreshProfile();
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function PlanBody({ r, profile, busy, onApply }: { r: PlanReview; profile: Profile; busy: boolean; onApply: (kcal: number) => void }) {
  const t = useT();
  const pct = r.targetKg ? Math.max(0, Math.min(100, (r.fatKg / r.targetKg) * 100)) : 0;
  const projPct = r.targetKg ? Math.max(0, Math.min(100, (r.projectedKg / r.targetKg) * 100)) : 0;
  const kg = (n: number) => fmt(n, 1);

  const status = {
    no_data: { cls: "warn", text: t("pl.noData") },
    reached: { cls: "ok", text: t("pl.reached", { kg: kg(r.fatKg) }) },
    on_track: { cls: "ok", text: t("pl.onTrack", { kg: kg(r.projectedKg), date: fmtDate(r.end, "full") }) },
    behind: {
      cls: "warn",
      text:
        r.neededPerDay == null
          ? t("pl.behindDone", { kg: kg(r.fatKg) })
          : t(r.neededTooHigh ? "pl.tooHigh" : "pl.behind", { kg: kg(r.projectedKg), n: fmt(r.neededPerDay), d: r.daysLeft }),
    },
  }[r.status];

  const body = (c: PlanReview["bfm"], digits = 1) =>
    c == null ? { value: "—", note: t("pl.noBody") } : c.change == null ? { value: fmt(c.to, digits), note: t("pl.needTwo") } : { value: fmtSigned(c.change, digits), note: t("pl.fromTo", { from: fmt(c.from, digits), to: fmt(c.to, digits) }) };
  const bfm = body(r.bfm);
  const smm = body(r.smm);
  const waist = body(r.waist);

  const cells = [
    { label: t("wk.logged"), value: `${r.loggedDays}/${r.elapsed}`, unit: t("wk.daysUnit"), note: t("pl.loggedNote") },
    { label: t("wk.deficit"), value: fmt(r.avgDeficit), unit: t("wk.perDay"), note: t("wk.total", { n: fmt(r.deficitTotal) }), tone: r.avgDeficit >= 0 ? "good" : "bad" },
    { label: t("wk.intake"), value: fmt(r.intakeAvg), unit: "kcal", note: t("kpi.target", { n: fmt(profile.kcal_target) }) },
    { label: t("macro.protein"), value: fmt(r.proteinAvg), unit: "g", note: t("wk.hit", { n: r.proteinHit, days: r.proteinDays }) },
    { label: t("wk.gym"), value: `${r.gymDone}/${r.gymPlanned}`, unit: t("wk.sessions"), note: t("pl.gymNote") },
    { label: t("pl.lifts"), value: `↑${r.lifts.up} · =${r.lifts.flat} · ↓${r.lifts.down}`, unit: "", note: t("pl.liftsNote"), tone: r.lifts.down > r.lifts.up ? "bad" : "" },
  ];

  return (
    <>
      <p className={`alert ${status.cls}`}>{status.text}</p>

      <section className="card">
        <div className="card-head">
          <h2>{t("pl.fat")}</h2>
          {r.targetKg != null && <span className="pct-badge">{fmt(pct, 0)}%</span>}
        </div>
        <div className="bar lg plan-bar">
          <div className="proj" style={{ width: `${projPct}%` }} />
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="row-between small muted" style={{ marginTop: 8 }}>
          <span>{t("pl.fatNow", { kg: kg(r.fatKg), n: fmt(r.deficitTotal) })}</span>
          <span>{r.targetKg != null ? t("pl.fatTarget", { kg: kg(r.targetKg), proj: kg(r.projectedKg) }) : t("pl.noTarget")}</span>
        </div>
        <p className="hint">{t("pl.fatHint", { k: fmt(KCAL_PER_KG) })}</p>
      </section>

      <section className="tiles">
        <Tile icon="target" label={t("pl.bfm")} value={bfm.value === "—" ? "—" : `${bfm.value} kg`} note={bfm.note} tone={r.bfm?.change != null && r.bfm.change < 0 ? "good" : undefined} />
        <Tile icon="dumbbell" label={t("bd.smm")} value={smm.value === "—" ? "—" : `${smm.value} kg`} note={smm.note} tone={r.smm?.change != null && r.smm.change > -0.5 ? "good" : undefined} />
        <Tile
          icon="scale"
          label={t("wk.weight")}
          value={r.weight ? `${fmtSigned(r.weight.change)} kg` : "—"}
          note={r.weight ? t("pl.fromTo", { from: kg(r.weight.from), to: kg(r.weight.to) }) : t("wk.needWeigh")}
          tone={r.weight && r.weight.change < 0 ? "good" : undefined}
        />
        <Tile icon="trend" label={t("bd.waist")} value={waist.value === "—" ? "—" : `${waist.value} cm`} note={waist.note} tone={r.waist?.change != null && r.waist.change < 0 ? "good" : undefined} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{t("pl.adherence")}</h2>
        </div>
        <div className="week-grid">
          {cells.map((c) => (
            <div key={c.label} className="week-cell">
              <div className="stat-label">{c.label}</div>
              <div className={`week-value ${c.tone ?? ""}`}>
                {c.value} {c.unit && <small>{c.unit}</small>}
              </div>
              <div className="tile-note">{c.note}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack">
        <div className="card-head">
          <h2>
            <Icon name="trend" size={18} /> {t("pl.next")}
          </h2>
        </div>
        {r.next ? (
          <>
            <div className="preview">
              <div>
                <span className="muted small">{t("pl.nextKcal")}</span>
                <b className="big">{fmt(r.next.kcal)} kcal</b>
              </div>
              <button className="btn primary sm" disabled={busy || profile.kcal_target === r.next.kcal} onClick={() => onApply(r.next!.kcal)}>
                {profile.kcal_target === r.next.kcal ? t("pl.applied") : t("pl.apply", { n: fmt(profile.kcal_target) })}
              </button>
            </div>
            <p className="muted small">{t(r.next.basis === "real" ? "pl.basisReal" : "pl.basisFormula", { tdee: fmt(r.next.tdee) })}</p>
          </>
        ) : (
          <p className="muted small">{t("pl.nextNeed")}</p>
        )}
        <ul className="review-tomorrow">
          <li>{t("pl.tip1", { p: profile.protein_target })}</li>
          <li>{t("pl.tip2")}</li>
          <li>{t("pl.tip3", { date: fmtDate(r.end, "full") })}</li>
        </ul>
      </section>
    </>
  );
}

function PlanForm({ profile, onSaved, onClose }: { profile: Profile; onSaved: () => Promise<void>; onClose: () => void }) {
  const t = useT();
  const [start, setStart] = useState(profile.plan_start ?? profile.start_date);
  const [end, setEnd] = useState(profile.plan_end ?? addDays(start, 41));
  const [target, setTarget] = useState(profile.fat_loss_target_kg == null ? "" : String(profile.fat_loss_target_kg));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await saveProfile({ id: profile.id, plan_start: start, plan_end: end, fat_loss_target_kg: target === "" ? null : Number(target) });
      await onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={t("pl.formTitle")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="row2">
          <label>
            {t("pl.start")}
            <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            {t("pl.end")}
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          </label>
        </div>
        <label>
          {t("pl.targetKg")}
          <input type="number" inputMode="decimal" min="0" max="50" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <p className="hint">{t("pl.formHint", { date: fmtDate(profile.start_date, "full") })}</p>
        {err && <p className="alert err">{err}</p>}
        <button className="btn primary block" disabled={busy}>
          {t("common.save")}
        </button>
      </form>
    </Modal>
  );
}

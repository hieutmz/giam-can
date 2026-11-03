import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { MetricChart } from "../components/charts";
import Icon from "../components/Icon";
import Modal from "../components/Modal";
import { usePrefs } from "../i18n";
import { addStrengthSet, deleteStrengthSet, listStrengthSets } from "../lib/api";
import { addDays, fmt, fmtDate, parseISODate, today } from "../lib/date";
import { CUSTOM_PREFIX, LIFT_GROUPS, LIFTS, PLAN_IDS, PLANS, WEEK_PLAN, customLiftId, isLiftPlan, liftById, type Lift, type PlanId } from "../lib/lifts";
import { e1rm, lastBefore, progressPoints, sessionStats, sessionsOf, strengthDrop, suggestNext, type Session } from "../lib/strength";
import type { StrengthSet } from "../lib/types";

type Prefs = ReturnType<typeof usePrefs>;

const liftLabel = (p: Prefs, l: Lift) => (l.id.startsWith(CUSTOM_PREFIX) ? l.name : p.tx(`lift.${l.id}`, l.name));
const setLabel = (s: Pick<StrengthSet, "weight_kg" | "reps">) => (s.weight_kg == null ? `×${s.reps}` : `${fmt(Number(s.weight_kg), 1)}×${s.reps}`);
const unique = (xs: string[]) => [...new Set(xs)];

export default function Strength() {
  const prefs = usePrefs();
  const { t } = prefs;
  const [date, setDate] = useState(today());
  const [all, setAll] = useState<StrengthSet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  /** undefined: theo lịch tuần; null: không theo buổi nào */
  const [plan, setPlan] = useState<PlanId | null | undefined>(undefined);
  const [extra, setExtra] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [chartLift, setChartLift] = useState<string | null>(null);

  useEffect(() => {
    listStrengthSets()
      .then(setAll)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    setPlan(undefined);
    setExtra([]);
  }, [date]);

  const scheduled = WEEK_PLAN[parseISODate(date).getDay()];
  const active = plan === undefined ? (isLiftPlan(scheduled) ? scheduled : null) : plan;
  const lifts = unique([...(active ? PLANS[active] : []), ...all.filter((s) => s.log_date === date).map((s) => s.lift), ...extra]).map(liftById);
  const history = useMemo(() => unique(all.map((s) => s.lift)), [all]);
  const shownChart = chartLift && history.includes(chartLift) ? chartLift : history.at(-1) ?? null;
  const isToday = date === today();

  async function add(s: Omit<StrengthSet, "id" | "created_at">) {
    try {
      const row = await addStrengthSet(s);
      setAll((xs) => [...xs, row]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    setAll((xs) => xs.filter((x) => x.id !== id));
    await deleteStrengthSet(id).catch((e) => setError(e.message));
  }

  return (
    <div className="page wide">
      <header className="bg-diary page-head with-action">
        <div>
          <h1>{t("sg.title")}</h1>
          <p className="muted">{isToday ? `${t("diary.today")} · ${fmtDate(date, "long")}` : fmtDate(date, "long")}</p>
        </div>
        <div className="toolbar">
          <div className="btn-group">
            <button className="btn secondary sm icon-only" onClick={() => setDate(addDays(date, -1))} aria-label={t("diary.prevDay")}>
              <Icon name="left" size={16} />
            </button>
            <label className="date-field">
              <Icon name="calendar" size={16} />
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t("col.date")} />
            </label>
            <button className="btn secondary sm icon-only" onClick={() => setDate(addDays(date, 1))} aria-label={t("diary.nextDay")}>
              <Icon name="right" size={16} />
            </button>
          </div>
          <button className="btn secondary sm" onClick={() => setDate(today())} disabled={isToday}>
            {t("diary.goToday")}
          </button>
        </div>
      </header>

      {error && <p className="alert err">{error}</p>}

      <section className="card stack">
        <div className="row-between">
          <span>
            {t("sg.schedule")} <b>{t(`plan.${scheduled}`)}</b>
          </span>
          <button className="btn primary sm" onClick={() => setPicking(true)}>
            <Icon name="plus" size={16} /> {t("sg.addLift")}
          </button>
        </div>
        <div className="chips scroll-x">
          {PLAN_IDS.map((p) => (
            <button key={p} type="button" className={active === p ? "chip active" : "chip"} onClick={() => setPlan(p)}>
              {t(`plan.${p}`)}
            </button>
          ))}
          <button type="button" className={active === null ? "chip active" : "chip"} onClick={() => setPlan(null)}>
            {t("sg.planNone")}
          </button>
        </div>
        {!active && lifts.length === 0 && <p className="muted small">{t("sg.offDay")}</p>}
        <p className="hint">
          {t("sg.kcalHint")} <Link to={isToday ? "/nhat-ky" : `/ngay/${date}`}>{t("sg.openDiary")}</Link>
        </p>
      </section>

      {!loaded ? (
        <p className="muted empty">{t("common.loading")}</p>
      ) : (
        <div className="lift-grid">
          {lifts.map((l) => (
            <LiftCard key={`${date}:${l.id}`} lift={l} date={date} sessions={sessionsOf(all, l.id)} onAdd={add} onDelete={remove} />
          ))}
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>
            <Icon name="trend" size={18} /> {t("sg.progress")}
          </h2>
        </div>
        {shownChart ? (
          <Progress lift={liftById(shownChart)} sessions={sessionsOf(all, shownChart)}>
            <div className="chips scroll-x">
              {history.map((id) => (
                <button key={id} type="button" className={id === shownChart ? "chip active" : "chip"} onClick={() => setChartLift(id)}>
                  {liftLabel(prefs, liftById(id))}
                </button>
              ))}
            </div>
          </Progress>
        ) : (
          <p className="muted empty">{t("sg.noHistory")}</p>
        )}
      </section>

      {picking && (
        <LiftPicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setExtra((xs) => unique([...xs, id]));
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function LiftCard({
  lift,
  date,
  sessions,
  onAdd,
  onDelete,
}: {
  lift: Lift;
  date: string;
  sessions: Session[];
  onAdd: (s: Omit<StrengthSet, "id" | "created_at">) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const prefs = usePrefs();
  const { t } = prefs;
  const [lo, hi] = lift.reps;
  const last = lastBefore(sessions, date);
  const current = sessions.find((s) => s.date === date)?.sets ?? [];
  const next = suggestNext(lift, last);
  const drop = strengthDrop(sessions.filter((s) => s.date <= date));
  const lastWeight = current.at(-1)?.weight_kg ?? next?.weight ?? (last ? sessionStats(last).topWeight : null);
  const [weight, setWeight] = useState(lastWeight == null ? "" : String(lastWeight));
  const [reps, setReps] = useState(String(next?.reps ?? lo));
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = Math.round(Number(reps));
    if (!(r > 0)) return;
    setBusy(true);
    await onAdd({ log_date: date, lift: lift.id, name: lift.name, reps: r, weight_kg: weight === "" ? null : Number(weight) });
    setBusy(false);
  }

  const suggestion =
    next &&
    (next.weight == null
      ? t("sg.suggestBw", { reps: next.reps })
      : t(next.kind === "up" ? "sg.suggestUp" : "sg.suggestReps", { w: fmt(next.weight, 1), reps: next.reps }));

  return (
    <section className="card lift-card">
      <div className="card-head">
        <h2>{liftLabel(prefs, lift)}</h2>
        <small className="muted">{t("sg.repRange", { lo, hi })}</small>
      </div>
      <div className="stack">
        <p className="muted small">
          {last ? t("sg.last", { date: fmtDate(last.date, "short"), sets: last.sets.map(setLabel).join(" · ") }) : t("sg.first", { lo, hi })}
        </p>
        {suggestion && <p className={next?.kind === "up" ? "suggest up" : "suggest"}>{suggestion}</p>}
        {drop != null && <p className="alert warn">{t("sg.drop", { pct: drop })}</p>}
        {current.length > 0 && (
          <ol className="set-list">
            {current.map((s, i) => {
              const est = e1rm(s.weight_kg, s.reps);
              return (
                <li key={s.id}>
                  <span className="muted">{t("sg.set", { n: i + 1 })}</span>
                  <b className="num">
                    {s.weight_kg == null ? "" : `${fmt(Number(s.weight_kg), 1)} kg × `}
                    {s.reps}
                  </b>
                  <small className="muted num">{est ? `1RM ~${fmt(est, 1)}` : ""}</small>
                  <button className="icon-btn sm danger" onClick={() => onDelete(s.id)} aria-label={t("common.delete", { name: t("sg.set", { n: i + 1 }) })}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <form className="set-add" onSubmit={submit}>
          <label>
            {t("sg.kg")}
            <input type="number" inputMode="decimal" min="0" step="any" placeholder={t("sg.bw")} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label>
            {t("sg.reps")}
            <input type="number" inputMode="numeric" min="1" step="1" value={reps} onChange={(e) => setReps(e.target.value)} required />
          </label>
          <button className="btn primary" disabled={busy}>
            <Icon name="plus" size={16} /> {t("sg.addSet")}
          </button>
        </form>
      </div>
    </section>
  );
}

function Progress({ lift, sessions, children }: { lift: Lift; sessions: Session[]; children: ReactNode }) {
  const { t } = usePrefs();
  const points = progressPoints(sessions);
  const byWeight = sessions.some((s) => sessionStats(s).best1rm != null);
  const label = byWeight ? t("sg.oneRm") : t("sg.bestReps");
  return (
    <div className="stack">
      {children}
      <MetricChart points={points} unit={byWeight ? "kg" : ""} digits={1} label={label} />
      <p className="hint">
        {label}
        {byWeight ? ` · ${t("sg.oneRmHint")}` : ""}
      </p>
      <ul className="entries">
        {[...sessions]
          .reverse()
          .slice(0, 6)
          .map((s) => (
            <li key={s.date}>
              <div className="entry-main">
                <span className="entry-name">{fmtDate(s.date, "full")}</span>
                <small className="muted">{s.sets.map(setLabel).join(" · ")}</small>
              </div>
              {byWeight && !lift.bodyweight && <small className="muted num">{t("sg.volume", { n: fmt(sessionStats(s).volume) })}</small>}
            </li>
          ))}
      </ul>
    </div>
  );
}

function LiftPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const prefs = usePrefs();
  const { t } = prefs;
  const [id, setId] = useState(LIFTS[0].id);
  const [custom, setCustom] = useState("");

  return (
    <Modal title={t("sg.addLiftTitle")} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          onPick(custom.trim() ? customLiftId(custom) : id);
        }}
      >
        <label>
          {t("sg.lift")}
          <select value={id} onChange={(e) => setId(e.target.value)} disabled={Boolean(custom.trim())}>
            {LIFT_GROUPS.map((g) => (
              <optgroup key={g} label={t(`liftg.${g}`)}>
                {LIFTS.filter((l) => l.group === g).map((l) => (
                  <option key={l.id} value={l.id}>
                    {liftLabel(prefs, l)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          {t("sg.customName")}
          <input value={custom} maxLength={60} placeholder={t("sg.customPh")} onChange={(e) => setCustom(e.target.value)} />
        </label>
        <button className="btn primary block">{t("sg.addLift")}</button>
      </form>
    </Modal>
  );
}

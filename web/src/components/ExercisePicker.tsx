import { useState, type FormEvent } from "react";
import { usePrefs } from "../i18n";
import { activityLabel, exerciseLabel } from "../i18n/labels";
import { addExercise } from "../lib/api";
import { exerciseKcal } from "../lib/calc";
import { fmt } from "../lib/date";
import { ACTIVITIES, ACTIVITY_GROUPS, activityById } from "../lib/exercises";
import type { ExerciseLog } from "../lib/types";
import Modal from "./Modal";

export default function ExercisePicker({
  date,
  weightKg,
  onAdded,
  onClose,
}: {
  date: string;
  weightKg: number;
  onAdded: (e: ExerciseLog) => void;
  onClose: () => void;
}) {
  const prefs = usePrefs();
  const { t, tx } = prefs;
  const [activity, setActivity] = useState("gym");
  const [minutes, setMinutes] = useState("30");
  const [level, setLevel] = useState("vua");
  const [speed, setSpeed] = useState("4.5");
  const [incline, setIncline] = useState("12");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const a = activityById(activity)!;
  const isWalk = a.kind === "treadmill" || a.kind === "outdoor";
  const input = {
    activity,
    minutes: Number(minutes) || 0,
    level: a.levels ? level : null,
    speed_kmh: isWalk ? Number(speed) || 0 : null,
    incline_pct: isWalk ? Number(incline) || 0 : null,
  };
  const kcal = exerciseKcal(input, weightKg);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      onAdded(
        await addExercise({
          log_date: date,
          name: exerciseLabel(prefs, { ...input, name: a.name }),
          ...input,
          kcal: Math.round(kcal * 10) / 10,
        }),
      );
      onClose();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={t("ex.title")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          {t("ex.activity")}
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {ACTIVITY_GROUPS.map((g) => (
              <optgroup key={g} label={t(`exg.${g}`)}>
                {ACTIVITIES.filter((x) => x.group === g).map((x) => (
                  <option key={x.id} value={x.id}>
                    {activityLabel(prefs, x.id, x.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          {t("ex.minutes")}
          <input type="number" inputMode="decimal" min="1" step="any" value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
        </label>
        <div className="chips">
          {[15, 30, 45, 60, 90].map((n) => (
            <button type="button" key={n} className={Number(minutes) === n ? "chip active" : "chip"} onClick={() => setMinutes(String(n))}>
              {t("common.minutes", { n })}
            </button>
          ))}
        </div>
        {isWalk && (
          <div className="row2">
            <label>
              {t("ex.speed")}
              <input type="number" inputMode="decimal" min="1" max="25" step="0.1" value={speed} onChange={(e) => setSpeed(e.target.value)} required />
            </label>
            <label>
              {t("ex.incline")}
              <input type="number" inputMode="decimal" min="0" max="30" step="0.5" value={incline} onChange={(e) => setIncline(e.target.value)} />
            </label>
          </div>
        )}
        {a.levels && (
          <div>
            <span className="label">{t("ex.intensity")}</span>
            <div className="seg">
              {a.levels.map((l) => (
                <button type="button" key={l.id} className={level === l.id ? "active" : ""} onClick={() => setLevel(l.id)}>
                  {tx(`level.${l.id}`, l.label)} <small>{fmt(l.met, 1)} MET</small>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="preview">
          <div>
            <span className="muted small">{t("ex.estimate")}</span>
            <b className="big">{fmt(kcal)} kcal</b>
          </div>
          <span className="muted small">
            {isWalk ? t("ex.acsm") : t("ex.met")} · {fmt(weightKg, 1)} kg
          </span>
        </div>
        <p className="hint">{isWalk ? t("ex.walkHint") : t("ex.metHint")}</p>
        {err && <p className="alert err">{err}</p>}
        <button className="btn primary block" disabled={busy || kcal <= 0}>
          {t("ex.add")}
        </button>
      </form>
    </Modal>
  );
}

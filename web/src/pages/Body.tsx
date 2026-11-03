import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MetricChart } from "../components/charts";
import Icon, { type IconName } from "../components/Icon";
import Modal from "../components/Modal";
import Tile from "../components/Tile";
import { useT } from "../i18n";
import type { Key } from "../i18n/vi";
import { deleteMeasurement, listMeasurements, saveMeasurement } from "../lib/api";
import { fmt, fmtDate, fmtSigned, today } from "../lib/date";
import { metricChange, muscleLoss } from "../lib/progress";
import type { BodyMeasurement } from "../lib/types";

type MetricKey = "pbf" | "bfm_kg" | "smm_kg" | "waist_cm" | "weight_kg" | "visceral_fat";
type Metric = { key: MetricKey; label: Key; unit: string; digits: number; icon: IconName; step: string };

const METRICS: Metric[] = [
  { key: "pbf", label: "bd.pbf", unit: "%", digits: 1, icon: "flame", step: "0.1" },
  { key: "bfm_kg", label: "bd.bfm", unit: "kg", digits: 1, icon: "target", step: "0.1" },
  { key: "smm_kg", label: "bd.smm", unit: "kg", digits: 1, icon: "dumbbell", step: "0.1" },
  { key: "waist_cm", label: "bd.waist", unit: "cm", digits: 1, icon: "trend", step: "0.1" },
  { key: "weight_kg", label: "bd.weight", unit: "kg", digits: 1, icon: "scale", step: "0.1" },
  { key: "visceral_fat", label: "bd.visceral", unit: "", digits: 0, icon: "leaf", step: "1" },
];

export default function Body() {
  const t = useT();
  const [rows, setRows] = useState<BodyMeasurement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<BodyMeasurement | "new" | null>(null);
  const [metric, setMetric] = useState<MetricKey>("pbf");

  const reload = () =>
    listMeasurements()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  useEffect(() => {
    void reload();
  }, []);

  const active = METRICS.find((m) => m.key === metric)!;
  const points = useMemo(
    () => rows.flatMap((r) => (r[metric] == null ? [] : [{ date: r.measured_on, value: Number(r[metric]) }])),
    [rows, metric],
  );
  const lostMuscle = muscleLoss(rows);

  async function remove(r: BodyMeasurement) {
    if (!confirm(t("bd.confirmDelete", { date: fmtDate(r.measured_on, "full") }))) return;
    await deleteMeasurement(r.id).catch((e) => setError(e.message));
    void reload();
  }

  return (
    <div className="page">
      <header className="bg-stats page-head with-action">
        <div>
          <h1>{t("bd.title")}</h1>
          <p className="muted">{t("bd.desc")}</p>
        </div>
        <button className="btn primary" onClick={() => setEditing("new")}>
          <Icon name="plus" size={18} /> {t("bd.add")}
        </button>
      </header>

      {error && <p className="alert err">{error}</p>}
      {lostMuscle != null && <p className="alert warn">{t("bd.muscleWarn", { kg: fmt(Math.abs(lostMuscle), 1) })}</p>}

      {!loaded ? (
        <p className="muted empty">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <section className="card empty-state">
          <span className="empty-icon">
            <Icon name="scale" size={28} />
          </span>
          <h2>{t("bd.empty")}</h2>
          <p className="muted">{t("bd.emptyHint")}</p>
          <button className="btn primary" onClick={() => setEditing("new")}>
            <Icon name="plus" size={18} /> {t("bd.add")}
          </button>
        </section>
      ) : (
        <>
          <section className="tiles">
            {METRICS.slice(0, 4).map((m) => {
              const c = metricChange(rows, m.key);
              return (
                <Tile
                  key={m.key}
                  icon={m.icon}
                  label={t(m.label)}
                  value={c ? `${fmt(c.latest, m.digits)} ${m.unit}` : "—"}
                  note={c?.fromFirst != null ? t("bd.fromFirst", { d: `${fmtSigned(c.fromFirst, m.digits)} ${m.unit}` }) : t("bd.single")}
                />
              );
            })}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>{t("bd.chart")}</h2>
            </div>
            <div className="chips scroll-x">
              {METRICS.map((m) => (
                <button key={m.key} type="button" className={m.key === metric ? "chip active" : "chip"} onClick={() => setMetric(m.key)}>
                  {t(m.label)}
                </button>
              ))}
            </div>
            {points.length > 0 ? (
              <MetricChart points={points} unit={active.unit} digits={active.digits} label={t(active.label)} />
            ) : (
              <p className="muted empty">{t("bd.noMetric")}</p>
            )}
          </section>

          <section className="card flush">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("col.date")}</th>
                    <th className="num">{t("bd.pbf")}</th>
                    <th className="num">{t("bd.bfm")}</th>
                    <th className="num">{t("bd.smm")}</th>
                    <th className="num hide-sm">{t("bd.waist")}</th>
                    <th className="num hide-sm">{t("bd.weight")}</th>
                    <th className="num hide-md">{t("bd.visceral")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="cell-title">{fmtDate(r.measured_on, "full")}</span>
                        {r.note && <small className="muted">{r.note}</small>}
                      </td>
                      <td className="num">{fmt(r.pbf, 1)}</td>
                      <td className="num">{fmt(r.bfm_kg, 1)}</td>
                      <td className="num">{fmt(r.smm_kg, 1)}</td>
                      <td className="num hide-sm">{fmt(r.waist_cm, 1)}</td>
                      <td className="num hide-sm">{fmt(r.weight_kg, 1)}</td>
                      <td className="num hide-md">{fmt(r.visceral_fat)}</td>
                      <td className="num">
                        <div className="row-actions">
                          <button className="icon-btn sm" aria-label={t("common.edit", { name: fmtDate(r.measured_on, "full") })} onClick={() => setEditing(r)}>
                            <Icon name="pencil" size={16} />
                          </button>
                          <button className="icon-btn sm danger" aria-label={t("common.delete", { name: fmtDate(r.measured_on, "full") })} onClick={() => remove(r)}>
                            <Icon name="trash" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {editing && (
        <MeasurementForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function MeasurementForm({ initial, onSaved, onClose }: { initial?: BodyMeasurement; onSaved: () => void; onClose: () => void }) {
  const t = useT();
  const [date, setDate] = useState(initial?.measured_on ?? today());
  const [note, setNote] = useState(initial?.note ?? "");
  const [values, setValues] = useState<Record<MetricKey, string>>(() => {
    const text = (k: MetricKey) => (initial?.[k] == null ? "" : String(initial[k]));
    return { pbf: text("pbf"), bfm_kg: text("bfm_kg"), smm_kg: text("smm_kg"), waist_cm: text("waist_cm"), weight_kg: text("weight_kg"), visceral_fat: text("visceral_fat") };
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const hasValue = Object.values(values).some((v) => v !== "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const num = (k: MetricKey) => (values[k] === "" ? null : Number(values[k]));
    try {
      await saveMeasurement(initial?.id ?? null, {
        measured_on: date,
        pbf: num("pbf"),
        bfm_kg: num("bfm_kg"),
        smm_kg: num("smm_kg"),
        waist_cm: num("waist_cm"),
        weight_kg: num("weight_kg"),
        visceral_fat: num("visceral_fat"),
        note: note.trim() || null,
      });
      onSaved();
    } catch (e) {
      const message = (e as Error).message;
      setErr(/duplicate|unique/i.test(message) ? t("bd.duplicate") : message);
      setBusy(false);
    }
  }

  return (
    <Modal title={t(initial ? "bd.editTitle" : "bd.addTitle")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          {t("col.date")}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="row2">
          {METRICS.map((m) => (
            <label key={m.key}>
              {t(m.label)}
              {m.unit ? ` (${m.unit})` : ""}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step={m.step}
                value={values[m.key]}
                onChange={(e) => setValues((v) => ({ ...v, [m.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <label>
          {t("diary.note")}
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {err && <p className="alert err">{err}</p>}
        <button className="btn primary block" disabled={busy || !hasValue}>
          {t(initial ? "common.save" : "bd.add")}
        </button>
      </form>
    </Modal>
  );
}

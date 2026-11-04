import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useT } from "../i18n";
import { deleteLab, listLabs, saveLab } from "../lib/api";
import { fmt, fmtDate, fmtSigned, today } from "../lib/date";
import { LAB_KEYS, labChange, labLimit, nearestBody, overLimit, type LabKey } from "../lib/labs";
import type { BodyMeasurement, LabResult } from "../lib/types";
import { MetricChart } from "./charts";
import Icon from "./Icon";
import Modal from "./Modal";

const LABEL: Record<LabKey, string> = { alt: "ALT (GPT)", ast: "AST (GOT)", ggt: "GGT" };

/** Xét nghiệm men gan theo thời gian, đặt cạnh số đo mỡ / cân nặng gần ngày xét nghiệm nhất. */
export default function LabsSection({ body }: { body: BodyMeasurement[] }) {
  const t = useT();
  const { profile } = useAuth();
  const sex = profile?.sex ?? "male";
  const [rows, setRows] = useState<LabResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<LabResult | "new" | null>(null);
  const [key, setKey] = useState<LabKey>("alt");

  const reload = () =>
    listLabs()
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  useEffect(() => {
    void reload();
  }, []);

  const points = useMemo(() => rows.flatMap((r) => (r[key] == null ? [] : [{ date: r.measured_on, value: Number(r[key]) }])), [rows, key]);
  const limit = labLimit(key, sex);
  const change = labChange(rows, key);
  const bodyThen = change ? nearestBody(body, change.first.date) : null;
  const bodyNow = change ? nearestBody(body, change.last.date) : null;
  const fatChange = bodyThen?.bfm_kg != null && bodyNow?.bfm_kg != null && bodyThen !== bodyNow ? Number(bodyNow.bfm_kg) - Number(bodyThen.bfm_kg) : null;

  async function remove(r: LabResult) {
    if (!confirm(t("lab.confirmDelete", { date: fmtDate(r.measured_on, "full") }))) return;
    await deleteLab(r.id).catch((e) => setError(e.message));
    void reload();
  }

  const cell = (r: LabResult, k: LabKey) => {
    const over = overLimit(r[k] == null ? null : Number(r[k]), labLimit(k, sex));
    return (
      <td key={k} className="num">
        <span className={over ? "delta bad" : ""}>{fmt(r[k] == null ? null : Number(r[k]))}</span>
        {over && <small className="muted">×{fmt(over, 1)}</small>}
      </td>
    );
  };

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <Icon name="droplet" size={18} /> {t("lab.title")}
        </h2>
        <button className="btn primary sm" onClick={() => setEditing("new")}>
          <Icon name="plus" size={16} /> {t("lab.add")}
        </button>
      </div>
      {error && <p className="alert err">{error}</p>}
      {!loaded ? (
        <p className="muted empty">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="muted small">{t("lab.empty")}</p>
      ) : (
        <div className="stack">
          <div className="chips scroll-x">
            {LAB_KEYS.map((k) => (
              <button key={k} type="button" className={k === key ? "chip active" : "chip"} onClick={() => setKey(k)}>
                {LABEL[k]}
              </button>
            ))}
          </div>
          {points.length > 0 ? (
            <MetricChart points={points} unit="U/L" digits={0} label={LABEL[key]} limit={limit} />
          ) : (
            <p className="muted empty">{t("bd.noMetric")}</p>
          )}
          <p className="hint">{t("lab.limitHint", { name: LABEL[key], n: limit })}</p>
          {change && (
            <p className="small">
              {t("lab.change", {
                name: LABEL[key],
                from: fmt(change.first.value),
                to: fmt(change.last.value),
                pct: change.pct == null ? "—" : fmtSigned(change.pct, 0),
              })}
              {fatChange != null && ` ${t("lab.fatChange", { kg: fmtSigned(fatChange, 1) })}`}
            </p>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("col.date")}</th>
                  {LAB_KEYS.map((k) => (
                    <th key={k} className="num">
                      {LABEL[k].split(" ")[0]}
                    </th>
                  ))}
                  <th className="num hide-sm">{t("lab.bodyThen")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => {
                  const b = nearestBody(body, r.measured_on);
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="cell-title">{fmtDate(r.measured_on, "full")}</span>
                        {r.note && <small className="muted">{r.note}</small>}
                      </td>
                      {LAB_KEYS.map((k) => cell(r, k))}
                      <td className="num hide-sm">
                        {b ? `${fmt(b.bfm_kg == null ? null : Number(b.bfm_kg), 1)} kg · ${fmt(b.weight_kg == null ? null : Number(b.weight_kg), 1)} kg` : "—"}
                      </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">{t("lab.disclaimer")}</p>
        </div>
      )}
      {editing && (
        <LabForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </section>
  );
}

function LabForm({ initial, onSaved, onClose }: { initial?: LabResult; onSaved: () => void; onClose: () => void }) {
  const t = useT();
  const [date, setDate] = useState(initial?.measured_on ?? today());
  const [values, setValues] = useState<Record<LabKey, string>>(() => {
    const text = (k: LabKey) => (initial?.[k] == null ? "" : String(initial[k]));
    return { alt: text("alt"), ast: text("ast"), ggt: text("ggt") };
  });
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const num = (k: LabKey) => (values[k] === "" ? null : Number(values[k]));
    try {
      await saveLab(initial?.id ?? null, { measured_on: date, alt: num("alt"), ast: num("ast"), ggt: num("ggt"), note: note.trim() || null });
      onSaved();
    } catch (e) {
      const message = (e as Error).message;
      setErr(/duplicate|unique/i.test(message) ? t("bd.duplicate") : message);
      setBusy(false);
    }
  }

  return (
    <Modal title={t(initial ? "lab.editTitle" : "lab.add")} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          {t("col.date")}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="row3">
          {LAB_KEYS.map((k) => (
            <label key={k}>
              {LABEL[k]} (U/L)
              <input type="number" inputMode="decimal" min="0" step="any" value={values[k]} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
        <label>
          {t("diary.note")}
          <input value={note} placeholder={t("lab.notePh")} onChange={(e) => setNote(e.target.value)} />
        </label>
        {err && <p className="alert err">{err}</p>}
        <button className="btn primary block" disabled={busy || LAB_KEYS.every((k) => values[k] === "")}>
          {t(initial ? "common.save" : "lab.add")}
        </button>
      </form>
    </Modal>
  );
}

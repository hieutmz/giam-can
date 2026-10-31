import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useT } from "../i18n";
import type { Key } from "../i18n/vi";
import { exportAll, type ExportData } from "../lib/api";
import { today } from "../lib/date";
import { daysCsv, downloadFile, exercisesCsv, foodsCsv } from "../lib/export";
import Icon from "./Icon";

const CSV = "text/csv;charset=utf-8";

const FILES: { id: string; label: Key; ext: "csv" | "json"; build: (d: ExportData) => string }[] = [
  { id: "ngay", label: "exp.days", ext: "csv", build: daysCsv },
  { id: "mon-an", label: "exp.foods", ext: "csv", build: foodsCsv },
  { id: "bai-tap", label: "exp.exercises", ext: "csv", build: exercisesCsv },
  { id: "toan-bo", label: "exp.all", ext: "json", build: (d) => JSON.stringify({ exported_at: new Date().toISOString(), ...d }, null, 2) },
];

/** Tải dữ liệu của tài khoản đang đăng nhập về máy. */
export default function DataExport() {
  const t = useT();
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(file: (typeof FILES)[number]) {
    setBusy(true);
    setErr("");
    try {
      const data = await exportAll(session!.user.id);
      downloadFile(`giam-can-${file.id}-${today()}.${file.ext}`, file.build(data), file.ext === "csv" ? CSV : "application/json");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <div className="card-head">
        <h2>
          <Icon name="download" size={18} /> {t("exp.title")}
        </h2>
      </div>
      <p className="muted small">{t("exp.desc")}</p>
      <div className="chips">
        {FILES.map((f) => (
          <button key={f.id} type="button" className="chip" disabled={busy} onClick={() => run(f)}>
            {t(f.label)}
          </button>
        ))}
      </div>
      {err && <p className="alert err">{err}</p>}
    </section>
  );
}

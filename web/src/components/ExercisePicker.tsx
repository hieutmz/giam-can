import { useState, type FormEvent } from "react";
import { addExercise } from "../lib/api";
import { exerciseKcal } from "../lib/calc";
import { fmt } from "../lib/date";
import { ACTIVITIES, activityById } from "../lib/exercises";
import type { ExerciseLog } from "../lib/types";
import Modal from "./Modal";

const GROUPS = ["Gym", "Cardio", "Thể thao", "Khác"] as const;

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
      const levelLabel = a.levels?.find((l) => l.id === level)?.label;
      const detail = isWalk ? `${speed} km/h, dốc ${incline}%` : levelLabel ? `cường độ ${levelLabel.toLowerCase()}` : "";
      onAdded(
        await addExercise({
          log_date: date,
          name: detail ? `${a.name} (${detail})` : a.name,
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
    <Modal title="Thêm bài tập" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label>
          Môn tập
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {ACTIVITIES.filter((x) => x.group === g).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Thời gian (phút)
          <input type="number" inputMode="decimal" min="1" step="any" value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
        </label>
        {isWalk && (
          <div className="row2">
            <label>
              Tốc độ (km/h)
              <input type="number" inputMode="decimal" min="1" max="25" step="0.1" value={speed} onChange={(e) => setSpeed(e.target.value)} required />
            </label>
            <label>
              Độ dốc (%)
              <input type="number" inputMode="decimal" min="0" max="30" step="0.5" value={incline} onChange={(e) => setIncline(e.target.value)} />
            </label>
          </div>
        )}
        {a.levels && (
          <div>
            <span className="label">Cường độ</span>
            <div className="chips">
              {a.levels.map((l) => (
                <button type="button" key={l.id} className={level === l.id ? "chip active" : "chip"} onClick={() => setLevel(l.id)}>
                  {l.label} · {l.met} MET
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="preview">
          <div>
            <span className="muted small">Tiêu hao ước tính</span>
            <b className="big">{fmt(kcal)} kcal</b>
          </div>
          <span className="muted small">
            {isWalk ? "Phương trình ACSM" : "MET"} · {fmt(weightKg, 1)} kg
          </span>
        </div>
        <p className="muted small">
          {isWalk
            ? `Đi bộ dưới 8 km/h, chạy từ 8 km/h. Đã trừ năng lượng nghỉ (đã nằm trong BMR) để không tính trùng.`
            : `kcal = (MET − 1) × cân nặng × giờ. Đã trừ 1 MET nghỉ (đã nằm trong BMR) để không tính trùng.`}
        </p>
        {err && <p className="err">{err}</p>}
        <button className="primary" disabled={busy || kcal <= 0}>
          Thêm vào nhật ký
        </button>
      </form>
    </Modal>
  );
}

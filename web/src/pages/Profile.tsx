import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { saveProfile } from "../lib/api";
import { bmrMifflin, effectiveBmr } from "../lib/calc";
import { fmt } from "../lib/date";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

const FACTORS = [
  { v: 1.2, label: "1,2 — Ngồi nhiều (văn phòng)" },
  { v: 1.3, label: "1,3 — Đi lại nhẹ trong ngày" },
  { v: 1.4, label: "1,4 — Công việc đứng / đi lại nhiều" },
  { v: 1.5, label: "1,5 — Lao động chân tay" },
];

export default function ProfilePage() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [p, setP] = useState<Profile | null>(profile);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setP(profile), [profile]);
  if (!p || !session) return null;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  const num = (v: string) => (v === "" ? null : Number(v));
  const formula =
    p.birth_year && p.height_cm && p.weight_kg
      ? Math.round(bmrMifflin(p.sex, Number(p.weight_kg), Number(p.height_cm), new Date().getFullYear() - p.birth_year))
      : null;
  const bmr = effectiveBmr(p);
  const isNew = !profile?.height_cm || !profile?.weight_kg;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await saveProfile(p!);
      await refreshProfile();
      setMsg("Đã lưu.");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <div>
        <h1>Hồ sơ</h1>
        <p className="muted">{session.user.email}</p>
      </div>
      {isNew && <div className="card warn-card">Chào mừng! Hãy nhập chiều cao, cân nặng và năm sinh để web tính được lượng calo tiêu hao.</div>}

      <form className="card stack" onSubmit={submit}>
        <h2>Cơ thể</h2>
        <label>
          Tên hiển thị
          <input value={p.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} />
        </label>
        <div className="row2">
          <label>
            Giới tính
            <select value={p.sex} onChange={(e) => set("sex", e.target.value as Profile["sex"])}>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </label>
          <label>
            Năm sinh
            <input type="number" min="1900" max="2100" value={p.birth_year ?? ""} onChange={(e) => set("birth_year", num(e.target.value))} required />
          </label>
        </div>
        <div className="row2">
          <label>
            Chiều cao (cm)
            <input type="number" step="0.1" min="100" max="250" value={p.height_cm ?? ""} onChange={(e) => set("height_cm", num(e.target.value))} required />
          </label>
          <label>
            Cân nặng (kg)
            <input type="number" step="0.1" min="30" max="300" value={p.weight_kg ?? ""} onChange={(e) => set("weight_kg", num(e.target.value))} required />
          </label>
        </div>
        <label>
          BMR từ InBody (kcal/ngày, không bắt buộc)
          <input
            type="number"
            min="800"
            max="4000"
            value={p.bmr_override ?? ""}
            onChange={(e) => set("bmr_override", num(e.target.value))}
            placeholder={formula ? `Để trống sẽ dùng công thức: ${formula}` : ""}
          />
        </label>
        <label>
          Mức sinh hoạt (chưa tính buổi tập và bước chân)
          <select value={p.activity_factor} onChange={(e) => set("activity_factor", Number(e.target.value))}>
            {FACTORS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <div className="preview">
          <div>
            <span className="muted small">BMR đang dùng</span>
            <b className="big">{fmt(bmr)} kcal</b>
          </div>
          <span className="muted small">
            {p.bmr_override ? "từ InBody" : "Mifflin-St Jeor"} · nền {fmt(bmr ? bmr * p.activity_factor : null)} kcal/ngày
          </span>
        </div>

        <h2>Mục tiêu</h2>
        <div className="row2">
          <label>
            Calo mỗi ngày
            <input type="number" min="800" max="6000" value={p.kcal_target} onChange={(e) => set("kcal_target", Number(e.target.value))} required />
          </label>
          <label>
            Protein mỗi ngày (g)
            <input type="number" min="0" max="400" value={p.protein_target} onChange={(e) => set("protein_target", Number(e.target.value))} required />
          </label>
        </div>
        <div className="row2">
          <label>
            Tổng thâm hụt cần đạt (kcal)
            <input type="number" min="0" step="100" value={p.deficit_goal} onChange={(e) => set("deficit_goal", Number(e.target.value))} required />
            <small className="muted">7.700 kcal ≈ 1 kg mỡ · {fmt(p.deficit_goal / 7700, 1)} kg</small>
          </label>
          <label>
            Ngày bắt đầu đếm
            <input type="date" value={p.start_date} onChange={(e) => set("start_date", e.target.value)} required />
          </label>
        </div>
        {msg && <p className={msg === "Đã lưu." ? "ok" : "err"}>{msg}</p>}
        <button className="primary" disabled={busy}>
          Lưu hồ sơ
        </button>
      </form>

      <ChangePassword />

      <button className="secondary" onClick={signOut}>
        Đăng xuất
      </button>
    </div>
  );
}

function ChangePassword() {
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.updateUser({ password: pw });
        setMsg(error ? error.message : "Đã đổi mật khẩu.");
        if (!error) setPw("");
      }}
    >
      <h2>Đổi mật khẩu</h2>
      <input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mật khẩu mới" required autoComplete="new-password" />
      {msg && <p className="muted">{msg}</p>}
      <button className="secondary">Đổi mật khẩu</button>
    </form>
  );
}

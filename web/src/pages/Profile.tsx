import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import Icon from "../components/Icon";
import { PrefsControls } from "../components/PrefsMenu";
import { useT } from "../i18n";
import { saveProfile } from "../lib/api";
import { bmrMifflin, effectiveBmr } from "../lib/calc";
import { fmt } from "../lib/date";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

const FACTORS = [
  { v: 1.2, key: "pf.f12" },
  { v: 1.3, key: "pf.f13" },
  { v: 1.4, key: "pf.f14" },
  { v: 1.5, key: "pf.f15" },
] as const;

export default function ProfilePage() {
  const t = useT();
  const { profile, session, refreshProfile, signOut } = useAuth();
  const [p, setP] = useState<Profile | null>(profile);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
  const name = p.display_name || session.user.email?.split("@")[0] || "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await saveProfile(p!);
      await refreshProfile();
      setMsg({ ok: true, text: t("pf.saved") });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="bg-profile profile-head">
        <div className="avatar xl">{name.charAt(0).toUpperCase()}</div>
        <div>
          <h1>{name}</h1>
          <p className="muted">{session.user.email}</p>
        </div>
      </header>

      {isNew && <div className="alert warn">{t("pf.welcome")}</div>}

      <div className="profile-grid">
        <form className="card stack" onSubmit={submit}>
          <h2>
            <Icon name="user" size={18} /> {t("pf.body")}
          </h2>
          <label>
            {t("pf.displayName")}
            <input value={p.display_name ?? ""} onChange={(e) => set("display_name", e.target.value)} />
          </label>
          <div className="row2">
            <label>
              {t("pf.sex")}
              <select value={p.sex} onChange={(e) => set("sex", e.target.value as Profile["sex"])}>
                <option value="male">{t("pf.male")}</option>
                <option value="female">{t("pf.female")}</option>
              </select>
            </label>
            <label>
              {t("pf.birthYear")}
              <input type="number" min="1900" max="2100" value={p.birth_year ?? ""} onChange={(e) => set("birth_year", num(e.target.value))} required />
            </label>
          </div>
          <div className="row2">
            <label>
              {t("pf.height")}
              <input type="number" step="0.1" min="100" max="250" value={p.height_cm ?? ""} onChange={(e) => set("height_cm", num(e.target.value))} required />
            </label>
            <label>
              {t("pf.weight")}
              <input type="number" step="0.1" min="30" max="300" value={p.weight_kg ?? ""} onChange={(e) => set("weight_kg", num(e.target.value))} required />
            </label>
          </div>
          <label>
            {t("pf.bmrInbody")}
            <input
              type="number"
              min="800"
              max="4000"
              value={p.bmr_override ?? ""}
              onChange={(e) => set("bmr_override", num(e.target.value))}
              placeholder={formula ? t("pf.bmrPh", { n: formula }) : ""}
            />
          </label>
          <label>
            {t("pf.activity")}
            <select value={p.activity_factor} onChange={(e) => set("activity_factor", Number(e.target.value))}>
              {FACTORS.map((f) => (
                <option key={f.v} value={f.v}>
                  {t(f.key)}
                </option>
              ))}
            </select>
          </label>
          <div className="preview">
            <div>
              <span className="muted small">{t("pf.bmrUsed")}</span>
              <b className="big">{fmt(bmr)} kcal</b>
            </div>
            <span className="muted small">
              {p.bmr_override ? t("pf.fromInbody") : t("pf.mifflin")} · {t("pf.baseline", { n: fmt(bmr ? bmr * p.activity_factor : null) })}
            </span>
          </div>

          <h2 className="section-gap">
            <Icon name="target" size={18} /> {t("pf.goals")}
          </h2>
          <div className="row2">
            <label>
              {t("pf.kcalTarget")}
              <input type="number" min="800" max="6000" value={p.kcal_target} onChange={(e) => set("kcal_target", Number(e.target.value))} required />
            </label>
            <label>
              {t("pf.proteinTarget")}
              <input type="number" min="0" max="400" value={p.protein_target} onChange={(e) => set("protein_target", Number(e.target.value))} required />
            </label>
          </div>
          <div className="row2">
            <label>
              {t("pf.deficitGoal")}
              <input type="number" min="0" step="100" value={p.deficit_goal} onChange={(e) => set("deficit_goal", Number(e.target.value))} required />
              <small className="muted">{t("pf.deficitHint", { kg: fmt(p.deficit_goal / 7700, 1) })}</small>
            </label>
            <label>
              {t("pf.startDate")}
              <input type="date" value={p.start_date} onChange={(e) => set("start_date", e.target.value)} required />
            </label>
          </div>
          {msg && <p className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
          <button className="btn primary block" disabled={busy}>
            {t("pf.save")}
          </button>
        </form>

        <div className="side-col">
          <section className="card">
            <h2>
              <Icon name="settings" size={18} /> {t("prefs.title")}
            </h2>
            <PrefsControls />
          </section>
          <ChangePassword />
          <button className="btn secondary block" onClick={signOut}>
            <Icon name="logout" size={18} /> {t("common.signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePassword() {
  const t = useT();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.updateUser({ password: pw });
        setMsg(error ? { ok: false, text: error.message } : { ok: true, text: t("pf.pwChanged") });
        if (!error) setPw("");
      }}
    >
      <h2>
        <Icon name="lock" size={18} /> {t("pf.changePw")}
      </h2>
      <input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t("pf.newPw")} required autoComplete="new-password" />
      {msg && <p className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
      <button className="btn secondary">{t("pf.changePw")}</button>
    </form>
  );
}

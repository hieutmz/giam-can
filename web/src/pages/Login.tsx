import { useState, type FormEvent } from "react";
import Icon, { type IconName } from "../components/Icon";
import PrefsMenu from "../components/PrefsMenu";
import { useT } from "../i18n";
import type { Key } from "../i18n/vi";
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup" | "reset";

const FEATURES: { icon: IconName; key: Key }[] = [
  { icon: "apple", key: "login.feature1" },
  { icon: "dumbbell", key: "login.feature2" },
  { icon: "trend", key: "login.feature3" },
];

export default function Login() {
  const t = useT();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function errText(m: string) {
    if (/invalid login/i.test(m)) return t("login.errInvalid");
    if (/already registered/i.test(m)) return t("login.errRegistered");
    if (/email not confirmed/i.test(m)) return t("login.errUnconfirmed");
    if (/password should be/i.test(m)) return t("login.errShortPw");
    return m;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: t("login.confirmSent") });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/ho-so" });
        if (error) throw error;
        setMsg({ ok: true, text: t("login.resetSent") });
      }
    } catch (err) {
      setMsg({ ok: false, text: errText((err as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "login" ? t("login.welcome") : mode === "signup" ? t("login.welcomeSignup") : t("login.resetTitle");
  const submitLabel = mode === "login" ? t("login.submitLogin") : mode === "signup" ? t("login.submitSignup") : t("login.submitReset");

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="brand light">
          <span className="brand-mark">
            <Icon name="leaf" size={20} />
          </span>
          <span className="brand-text">{t("app.name")}</span>
        </div>
        <h1>{t("login.heroTitle")}</h1>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.key}>
              <span>
                <Icon name={f.icon} size={18} />
              </span>
              {t(f.key)}
            </li>
          ))}
        </ul>
      </aside>

      <main className="auth-main">
        <PrefsMenu placement="down" className="auth-prefs" />
        <form className="auth-card stack" onSubmit={submit}>
          <div className="brand auth-brand-sm">
            <span className="brand-mark">
              <Icon name="leaf" size={20} />
            </span>
            <span className="brand-text">{t("app.name")}</span>
          </div>
          <div>
            <h2 className="auth-title">{title}</h2>
            <p className="muted">{t("app.tagline")}</p>
          </div>
          {mode !== "reset" && (
            <div className="seg">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
                {t("login.tabLogin")}
              </button>
              <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
                {t("login.tabSignup")}
              </button>
            </div>
          )}
          {mode === "signup" && (
            <label>
              {t("login.name")}
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
          )}
          <label>
            {t("login.email")}
            <div className="input-icon">
              <Icon name="mail" size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
          </label>
          {mode !== "reset" && (
            <label>
              {t("login.password")}
              <div className="input-icon">
                <Icon name="lock" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
            </label>
          )}
          {msg && <p className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</p>}
          <button className="btn primary block lg" disabled={busy}>
            {busy ? t("common.processing") : submitLabel}
          </button>
          {mode === "login" ? (
            <button type="button" className="link center-text" onClick={() => setMode("reset")}>
              {t("login.forgot")}
            </button>
          ) : mode === "reset" ? (
            <button type="button" className="link center-text" onClick={() => setMode("login")}>
              ← {t("login.back")}
            </button>
          ) : null}
        </form>
      </main>
    </div>
  );
}

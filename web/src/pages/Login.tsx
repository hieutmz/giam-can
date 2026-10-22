import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup" | "reset";

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

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
        if (!data.session) setMsg({ type: "ok", text: "Đã gửi email xác nhận. Mở email và bấm link để kích hoạt tài khoản." });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/ho-so" });
        if (error) throw error;
        setMsg({ type: "ok", text: "Đã gửi email đặt lại mật khẩu." });
      }
    } catch (err) {
      setMsg({ type: "err", text: viError((err as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card narrow stack" onSubmit={submit}>
        <div>
          <h1 style={{ marginBottom: 4 }}>🥗 Giảm Cân</h1>
          <p className="muted">Nhật ký ăn uống, luyện tập và theo dõi thâm hụt calo.</p>
        </div>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Đăng nhập
          </button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
            Đăng ký
          </button>
        </div>
        {mode === "signup" && (
          <label>
            Tên hiển thị
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        {mode !== "reset" && (
          <label>
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
        )}
        {msg && <p className={msg.type === "ok" ? "ok" : "err"}>{msg.text}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : mode === "signup" ? "Tạo tài khoản" : "Gửi email"}
        </button>
        {mode === "login" ? (
          <button type="button" className="link" onClick={() => setMode("reset")}>
            Quên mật khẩu?
          </button>
        ) : mode === "reset" ? (
          <button type="button" className="link" onClick={() => setMode("login")}>
            ← Quay lại đăng nhập
          </button>
        ) : null}
      </form>
    </div>
  );
}

function viError(m: string) {
  if (/invalid login/i.test(m)) return "Sai email hoặc mật khẩu.";
  if (/already registered/i.test(m)) return "Email này đã được đăng ký.";
  if (/email not confirmed/i.test(m)) return "Email chưa được xác nhận. Kiểm tra hộp thư của bạn.";
  if (/password should be/i.test(m)) return "Mật khẩu phải có ít nhất 6 ký tự.";
  return m;
}

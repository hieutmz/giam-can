import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import Icon, { type IconName } from "./components/Icon";
import PrefsMenu from "./components/PrefsMenu";
import { useT } from "./i18n";
import type { Key } from "./i18n/vi";
import { supabaseConfigured } from "./lib/supabase";
import Diary from "./pages/Diary";
import Foods from "./pages/Foods";
import History from "./pages/History";
import Login from "./pages/Login";
import MyFoods from "./pages/MyFoods";
import Overview from "./pages/Overview";
import ProfilePage from "./pages/Profile";

type NavItem = { to: string; label: Key; icon: IconName; hideMobile?: boolean };

const NAV: NavItem[] = [
  { to: "/", label: "nav.overview", icon: "trend" },
  { to: "/nhat-ky", label: "nav.diary", icon: "diary" },
  { to: "/thong-ke", label: "nav.stats", icon: "stats" },
  { to: "/mon-cua-toi", label: "nav.myFoods", icon: "star" },
  { to: "/thuc-pham", label: "nav.foods", icon: "apple", hideMobile: true },
  { to: "/ho-so", label: "nav.profile", icon: "user" },
];

export default function App() {
  const t = useT();
  const { session, profile, loading, signOut } = useAuth();

  if (!supabaseConfigured) return <SetupNeeded />;
  if (loading) return <div className="center muted">{t("common.loading")}</div>;
  if (!session) return <Login />;

  const needsProfile = profile && (!profile.height_cm || !profile.weight_kg);
  const name = profile?.display_name || session.user.email?.split("@")[0] || "";

  return (
    <div className="app">
      <header className="topnav">
        <div className="topnav-inner">
          <NavLink to="/" className="brand">
            <span className="brand-mark">
              <Icon name="leaf" size={18} />
            </span>
            <span className="brand-text">{t("app.name")}</span>
          </NavLink>
          <nav className="nav" aria-label="main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"}>
                {t(n.label)}
              </NavLink>
            ))}
          </nav>
          <div className="topnav-actions">
            <PrefsMenu placement="down" />
            <NavLink to="/ho-so" className="user-chip" title={session.user.email}>
              <span className="avatar">{name.charAt(0).toUpperCase()}</span>
              <span className="user-name">{name}</span>
            </NavLink>
            <button className="icon-btn" onClick={signOut} aria-label={t("common.signOut")} title={t("common.signOut")}>
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={needsProfile ? <Navigate to="/ho-so" replace /> : <Overview />} />
          <Route path="/nhat-ky" element={<Diary />} />
          <Route path="/ngay/:date" element={<Diary />} />
          <Route path="/thong-ke" element={<History />} />
          <Route path="/mon-cua-toi" element={<MyFoods />} />
          <Route path="/thuc-pham" element={<Foods />} />
          <Route path="/ho-so" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <nav className="tabbar" aria-label="tabs">
        {NAV.filter((n) => !n.hideMobile).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/"}>
            <Icon name={n.icon} size={20} />
            <span>{t(n.label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function SetupNeeded() {
  const t = useT();
  const code = (s: string) => `<code>${s}</code>`;
  return (
    <div className="center">
      <div className="card narrow stack">
        <h1>{t("setup.title")}</h1>
        <p
          // Nội dung tĩnh từ từ điển, không chứa dữ liệu người dùng
          dangerouslySetInnerHTML={{
            __html: t("setup.body", {
              file: code("web/.env.local"),
              url: code("VITE_SUPABASE_URL"),
              key: code("VITE_SUPABASE_ANON_KEY"),
              example: code(".env.example"),
              cmd: code("npm run dev"),
            }),
          }}
        />
      </div>
    </div>
  );
}

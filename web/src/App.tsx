import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import Icon, { type IconName } from "./components/Icon";
import PrefsMenu from "./components/PrefsMenu";
import { useT } from "./i18n";
import type { Key } from "./i18n/vi";
import { fmtDate } from "./lib/date";
import { supabaseConfigured } from "./lib/supabase";
import Diary from "./pages/Diary";
import Foods from "./pages/Foods";
import History from "./pages/History";
import Login from "./pages/Login";
import MyFoods from "./pages/MyFoods";
import ProfilePage from "./pages/Profile";

type NavItem = { to: string; label: Key; icon: IconName };

const NAV: { section: Key; items: NavItem[] }[] = [
  {
    section: "nav.sectionTrack",
    items: [
      { to: "/", label: "nav.diary", icon: "diary" },
      { to: "/thong-ke", label: "nav.stats", icon: "stats" },
    ],
  },
  {
    section: "nav.sectionData",
    items: [
      { to: "/mon-cua-toi", label: "nav.myFoods", icon: "star" },
      { to: "/thuc-pham", label: "nav.foods", icon: "apple" },
    ],
  },
  { section: "nav.sectionAccount", items: [{ to: "/ho-so", label: "nav.profile", icon: "user" }] },
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
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="leaf" size={16} />
          </span>
          <span className="brand-text">{t("app.name")}</span>
        </div>
        <nav className="nav">
          {NAV.map((g) => (
            <div key={g.section} className="nav-group">
              <div className="nav-section">{t(g.section)}</div>
              {g.items.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"} title={t(n.label)}>
                  <Icon name={n.icon} size={18} />
                  <span className="nav-label">{t(n.label)}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="who">
            <b>{name}</b>
            <small>{session.user.email}</small>
          </div>
          <button className="icon-btn" onClick={signOut} aria-label={t("common.signOut")} title={t("common.signOut")}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div className="brand mobile-only">
            <span className="brand-mark">
              <Icon name="leaf" size={16} />
            </span>
            {t("app.name")}
          </div>
          <Breadcrumbs />
          <div className="topbar-actions">
            <PrefsMenu placement="down" />
          </div>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={needsProfile ? <Navigate to="/ho-so" replace /> : <Diary />} />
            <Route path="/ngay/:date" element={<Diary />} />
            <Route path="/thong-ke" element={<History />} />
            <Route path="/mon-cua-toi" element={<MyFoods />} />
            <Route path="/thuc-pham" element={<Foods />} />
            <Route path="/ho-so" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const t = useT();
  const { pathname } = useLocation();
  const date = pathname.match(/^\/ngay\/(\d{4}-\d{2}-\d{2})$/)?.[1];
  const item = NAV.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section }))).find((i) =>
    date ? i.to === "/" : i.to === pathname,
  );
  if (!item) return <div className="crumbs" />;
  return (
    <nav className="crumbs" aria-label="breadcrumb">
      <span>{t(item.section)}</span>
      <Icon name="right" size={14} />
      {date ? (
        <>
          <NavLink to="/">{t(item.label)}</NavLink>
          <Icon name="right" size={14} />
          <b>{fmtDate(date, "full")}</b>
        </>
      ) : (
        <b>{t(item.label)}</b>
      )}
    </nav>
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

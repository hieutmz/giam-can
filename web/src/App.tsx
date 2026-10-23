import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { supabaseConfigured } from "./lib/supabase";
import Diary from "./pages/Diary";
import Foods from "./pages/Foods";
import History from "./pages/History";
import Login from "./pages/Login";
import MyFoods from "./pages/MyFoods";
import ProfilePage from "./pages/Profile";

const NAV = [
  { to: "/", label: "Nhật ký", icon: "📒" },
  { to: "/thong-ke", label: "Thống kê", icon: "📈" },
  { to: "/mon-cua-toi", label: "Món của tôi", icon: "⭐" },
  { to: "/thuc-pham", label: "Thực phẩm", icon: "🥦" },
  { to: "/ho-so", label: "Hồ sơ", icon: "👤" },
];

export default function App() {
  const { session, profile, loading, signOut } = useAuth();

  if (!supabaseConfigured) return <SetupNeeded />;
  if (loading) return <div className="center muted">Đang tải…</div>;
  if (!session) return <Login />;

  const needsProfile = profile && (!profile.height_cm || !profile.weight_kg);
  const name = profile?.display_name || session.user.email?.split("@")[0] || "";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">🥗 Giảm Cân</div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="who">
            <b>{name}</b>
            <small className="muted">{session.user.email}</small>
          </div>
          <button className="icon-btn" onClick={signOut} aria-label="Đăng xuất" title="Đăng xuất">
            ⎋
          </button>
        </div>
      </aside>
      <header className="mobile-bar">🥗 Giảm Cân</header>
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
  );
}

function SetupNeeded() {
  return (
    <div className="center">
      <div className="card narrow">
        <h1>Chưa cấu hình Supabase</h1>
        <p>
          Tạo file <code>web/.env.local</code> với <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code>{" "}
          (xem <code>.env.example</code>), rồi chạy lại <code>npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

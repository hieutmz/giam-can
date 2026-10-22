import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { supabaseConfigured } from "./lib/supabase";
import Diary from "./pages/Diary";
import Foods from "./pages/Foods";
import History from "./pages/History";
import Login from "./pages/Login";
import ProfilePage from "./pages/Profile";

const NAV = [
  { to: "/", label: "Nhật ký", icon: "📒" },
  { to: "/thong-ke", label: "Thống kê", icon: "📈" },
  { to: "/thuc-pham", label: "Thực phẩm", icon: "🥦" },
  { to: "/ho-so", label: "Hồ sơ", icon: "👤" },
];

export default function App() {
  const { session, profile, loading } = useAuth();

  if (!supabaseConfigured) return <SetupNeeded />;
  if (loading) return <div className="center muted">Đang tải…</div>;
  if (!session) return <Login />;

  const needsProfile = profile && (!profile.height_cm || !profile.weight_kg);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">🥗 Giảm Cân</span>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={needsProfile ? <Navigate to="/ho-so" replace /> : <Diary />} />
          <Route path="/ngay/:date" element={<Diary />} />
          <Route path="/thong-ke" element={<History />} />
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

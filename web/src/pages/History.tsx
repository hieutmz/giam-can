import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getRange } from "../lib/api";
import { effectiveBmr, summarizeDay, type DaySummary } from "../lib/calc";
import { addDays, daysBetween, fmt, formatVN, parseISODate, today } from "../lib/date";

type Row = { date: string; s: DaySummary; logged: boolean; steps: number | null; weight: number | null; cumulative: number };

export default function History() {
  const { profile } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getRange>> | null>(null);
  const [error, setError] = useState("");

  const start = profile?.start_date ?? today();
  const end = today();

  useEffect(() => {
    getRange(start, end).then(setData).catch((e) => setError(e.message));
  }, [start, end]);

  const rows: Row[] = useMemo(() => {
    if (!data || !profile) return [];
    const bmr = effectiveBmr(profile);
    if (!bmr) return [];
    const out: Row[] = [];
    let cum = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const foods = data.foods.filter((f) => f.log_date === d);
      const exercises = data.exercises.filter((e) => e.log_date === d);
      const day = data.days.find((x) => x.log_date === d);
      const logged = foods.length > 0;
      if (!logged && !day && !exercises.length) continue;
      const s = summarizeDay({
        bmr,
        activityFactor: Number(profile.activity_factor),
        weightKg: Number(day?.weight_kg ?? profile.weight_kg ?? 70),
        heightCm: Number(profile.height_cm ?? 165),
        foods,
        exercises,
        steps: day?.steps ?? null,
      });
      // Chỉ cộng vào bộ đếm những ngày đã nhập món ăn
      if (logged) cum += s.deficit;
      out.push({ date: d, s, logged, steps: day?.steps ?? null, weight: day?.weight_kg ?? null, cumulative: cum });
    }
    return out;
  }, [data, profile, start, end]);

  if (!profile) return null;
  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="muted">Đang tải…</p>;

  const goal = profile.deficit_goal;
  const logged = rows.filter((r) => r.logged);
  const total = logged.at(-1)?.cumulative ?? 0;
  const avg = logged.length ? total / logged.length : 0;
  const pct = Math.max(0, (total / goal) * 100);
  let eta = "—";
  if (avg > 0) {
    const d = parseISODate(end);
    d.setDate(d.getDate() + Math.ceil((goal - total) / avg));
    eta = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  const maxAbs = Math.max(1, ...logged.map((r) => Math.abs(r.s.deficit)));
  const weights = rows.filter((r) => r.weight);

  return (
    <div className="stack-lg">
      <div>
        <h1>Thống kê</h1>
        <p className="muted">
          Từ {formatVN(start, false)}/{start.slice(0, 4)} · {daysBetween(start, end) + 1} ngày · mục tiêu thâm hụt {fmt(goal)} kcal (≈{" "}
          {fmt(goal / 7700, 1)} kg mỡ)
        </p>
      </div>

      <section className="kpis">
        <div className="kpi">
          <div className="kpi-l">Đã tích lũy</div>
          <div className={`kpi-v ${total >= 0 ? "good" : "bad"}`}>{fmt(total)}</div>
          <div className="kpi-n">{fmt(pct, 2)}% mục tiêu</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">Còn lại</div>
          <div className="kpi-v">{fmt(Math.max(0, goal - total))}</div>
          <div className="kpi-n">≈ {fmt(Math.max(0, goal - total) / 7700, 1)} kg mỡ</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">TB / ngày</div>
          <div className="kpi-v">{fmt(avg)}</div>
          <div className="kpi-n">{logged.length} ngày đã nhập</div>
        </div>
        <div className="kpi">
          <div className="kpi-l">Dự kiến đạt</div>
          <div className="kpi-v">{eta}</div>
          <div className="kpi-n">theo tốc độ hiện tại</div>
        </div>
      </section>

      <div className="card">
        <h2>Tiến độ</h2>
        <div className="progress">
          <div style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="row-between small muted">
          <span>
            {fmt(total)} / {fmt(goal)} kcal
          </span>
          <span>{fmt(pct, 2)}%</span>
        </div>
      </div>

      {logged.length > 0 && (
        <div className="card">
          <h2>Thâm hụt từng ngày</h2>
          <div className="chart">
            {logged.slice(-30).map((r) => (
              <Link key={r.date} to={`/ngay/${r.date}`} className="col" title={`${formatVN(r.date)}: ${fmt(r.s.deficit)} kcal`}>
                <span className="t">{fmt(r.s.deficit)}</span>
                <div className={r.s.deficit < 0 ? "b neg" : "b"} style={{ height: `${(Math.abs(r.s.deficit) / maxAbs) * 110}px` }} />
                <span className="x">{formatVN(r.date, false)}</span>
              </Link>
            ))}
          </div>
          <p className="muted small">Xanh: thâm hụt · Đỏ: dư calo. Hiển thị tối đa 30 ngày gần nhất.</p>
        </div>
      )}

      <div className="card">
        <h2>Các ngày</h2>
        {rows.length === 0 ? (
          <p className="muted">Chưa có dữ liệu. Hãy bắt đầu ghi nhật ký hôm nay.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th className="num">Nạp</th>
                  <th className="num">Tiêu hao</th>
                  <th className="num">Thâm hụt</th>
                  <th className="num hide-sm">Protein</th>
                  <th className="num">Tích lũy</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map((r) => (
                  <tr key={r.date}>
                    <td>
                      <Link to={`/ngay/${r.date}`}>{formatVN(r.date, false)}</Link>
                    </td>
                    <td className="num">{r.logged ? fmt(r.s.intake) : <span className="muted">chưa nhập</span>}</td>
                    <td className="num">{fmt(r.s.tdee)}</td>
                    <td className={`num ${r.logged ? (r.s.deficit >= 0 ? "good" : "bad") : "muted"}`}>{r.logged ? fmt(r.s.deficit) : "—"}</td>
                    <td className="num hide-sm">{r.logged ? `${fmt(r.s.protein)} g` : "—"}</td>
                    <td className="num">{fmt(r.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {weights.length > 0 && (
        <div className="card">
          <h2>Cân nặng</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {[...weights].reverse().map((r) => (
                  <tr key={r.date}>
                    <td>{formatVN(r.date)}</td>
                    <td className="num">{fmt(Number(r.weight), 1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

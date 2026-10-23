import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { fmt, fmtDate } from "../lib/date";

/** Đo chiều rộng thật của phần tử để SVG vẽ đúng kích thước (chữ không bị phóng to/thu nhỏ). */
export function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/** Đường path SVG qua các điểm có giá trị; ngày trống (null) được nối liền thay vì ngắt đoạn. */
function linePath(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
  });
  return d.trim();
}

export function Sparkline({ values, color = "var(--accent)", width = 96, height = 32 }: { values: (number | null)[]; color?: string; width?: number; height?: number }) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) => 3 + (max === min ? 0.5 : (max - v) / (max - min)) * (height - 6);
  const d = linePath(values, x, y);
  const lastIdx = values.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).at(-1)!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="sparkline">
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(lastIdx)} cy={y(values[lastIdx]!)} r="2.5" fill={color} />
    </svg>
  );
}

export type Series = { key: string; label: string; color: string; values: (number | null)[]; dashed?: boolean };

/** Biểu đồ đường nhiều chuỗi, có lưới, trục và tooltip khi rê chuột. */
export function TrendChart({ dates, series, height = 260, unit = "kcal" }: { dates: string[]; series: Series[]; height?: number; unit?: string }) {
  const { ref, width: W } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const pad = { l: 48, r: 16, t: 12, b: 28 };
  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (!dates.length || !all.length) return <div ref={ref} className="chart-empty" style={{ height }} />;

  const step = 500;
  const min = Math.max(0, Math.floor((Math.min(...all) * 0.9) / step) * step);
  const max = Math.ceil((Math.max(...all) * 1.05) / step) * step || step;
  const x = (i: number) => pad.l + (dates.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (dates.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + ((max - v) / (max - min || 1)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  const labelEvery = Math.max(1, Math.ceil(dates.length / Math.max(2, Math.floor(W / 80))));

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.min(dates.length - 1, Math.max(0, Math.round(rel * (dates.length - 1)))));
  }

  return (
    <div ref={ref} className="trend">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="line-chart" role="img">
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} className="grid" />
            <text x={pad.l - 8} y={y(tk) + 4} textAnchor="end" className="axis">
              {fmt(tk)}
            </text>
          </g>
        ))}
        {dates.map((d, i) =>
          i === dates.length - 1 || (i % labelEvery === 0 && dates.length - 1 - i >= labelEvery * 0.6) ? (
            <text key={d} x={x(i)} y={H - 8} textAnchor={i === dates.length - 1 ? "end" : "middle"} className="axis">
              {fmtDate(d, "short")}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={linePath(s.values, x, y)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.dashed ? 1.5 : 2}
            strokeDasharray={s.dashed ? "5 4" : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series
          .filter((s) => !s.dashed)
          .map((s) =>
            s.values.map((v, i) => (v == null ? null : <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(v)} r={hover === i ? 4 : 2.5} fill={s.color} />)),
          )}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="guide" />}
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ left: Math.min(W - 180, Math.max(0, x(hover) + 12)), top: pad.t }}>
          <b>{fmtDate(dates[hover], "long")}</b>
          {series.map((s) => (
            <div key={s.key} className="tt-row">
              <span className="dot" style={{ background: s.color }} />
              <span>{s.label}</span>
              <b className="num">{s.values[hover] == null ? "—" : `${fmt(s.values[hover])} ${unit}`}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label}>
          <i className={it.dashed ? "dash" : ""} style={{ background: it.dashed ? undefined : it.color, borderColor: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function Donut({ parts, size = 148, stroke = 18, children }: { parts: { label: string; value: number; color: string }[]; size?: number; stroke?: number; children?: ReactNode }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        {total > 0 &&
          parts.map((p) => {
            const len = (p.value / total) * c;
            const el = (
              <circle
                key={p.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

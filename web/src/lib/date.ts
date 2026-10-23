// Locale hiện tại cho số và ngày; PrefsProvider cập nhật khi đổi ngôn ngữ.
let LOCALE = "vi-VN";
export const setLocale = (l: string) => {
  LOCALE = l;
};

/** YYYY-MM-DD theo giờ máy (không dùng UTC để tránh lệch ngày ở VN). */
export function toISODate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const today = () => toISODate(new Date());

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string) {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

const DATE_STYLES = {
  long: { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }, // thứ + ngày đầy đủ
  full: { day: "2-digit", month: "2-digit", year: "numeric" },
  short: { day: "2-digit", month: "2-digit" },
  weekday: { weekday: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export function fmtDate(s: string | Date, style: keyof typeof DATE_STYLES = "long") {
  const d = typeof s === "string" ? parseISODate(s) : s;
  return new Intl.DateTimeFormat(LOCALE, DATE_STYLES[style]).format(d);
}

export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });

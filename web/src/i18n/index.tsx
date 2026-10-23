import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setLocale } from "../lib/date";
import en from "./en";
import vi, { type Dict, type Key } from "./vi";
import zh from "./zh";

export type Lang = "vi" | "en" | "zh";
export type Theme = "system" | "light" | "dark";
export type Vars = Record<string, string | number>;

const DICTS: Record<Lang, Dict> = { vi, en, zh };
const LOCALES: Record<Lang, string> = { vi: "vi-VN", en: "en-GB", zh: "zh-CN" };
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: "vi", label: "Tiếng Việt", short: "VI" },
  { id: "en", label: "English", short: "EN" },
  { id: "zh", label: "中文", short: "中" },
];
export const THEMES: Theme[] = ["system", "light", "dark"];

const LANG_KEY = "gc-lang";
const THEME_KEY = "gc-theme";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* trình duyệt chặn storage: chỉ không nhớ lựa chọn */
  }
}

function initialLang(): Lang {
  const saved = read(LANG_KEY);
  if (saved === "vi" || saved === "en" || saved === "zh") return saved;
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("zh")) return "zh";
  if (nav.startsWith("en")) return "en";
  return "vi";
}

function initialTheme(): Theme {
  const saved = read(THEME_KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

function interpolate(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#09090b" : "#ffffff");
}

type Prefs = {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  t: (key: Key, vars?: Vars) => string;
  /** Dịch khóa động (nhóm thực phẩm, môn tập…); không có thì trả về fallback. */
  tx: (key: string, fallback: string, vars?: Vars) => string;
};

const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang();
    setLocale(LOCALES[l]);
    return l;
  });
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setLang = useCallback((l: Lang) => {
    setLocale(LOCALES[l]); // trước khi render lại để số và ngày định dạng đúng ngay
    write(LANG_KEY, l);
    setLangState(l);
  }, []);

  const setTheme = useCallback((th: Theme) => {
    write(THEME_KEY, th);
    setThemeState(th);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
    document.title = DICTS[lang]["app.name"];
  }, [lang]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const value = useMemo<Prefs>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      theme,
      setTheme,
      t: (key, vars) => interpolate(dict[key] ?? vi[key] ?? key, vars),
      tx: (key, fallback, vars) => interpolate((dict as Record<string, string>)[key] ?? fallback, vars),
    };
  }, [lang, theme, setLang, setTheme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs phải nằm trong PrefsProvider");
  return v;
}

export const useT = () => usePrefs().t;
export type { Key };

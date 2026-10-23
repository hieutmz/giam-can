import { useEffect, useRef, useState } from "react";
import { LANGS, THEMES, usePrefs, type Theme } from "../i18n";
import Icon, { type IconName } from "./Icon";

export const THEME_ICON: Record<Theme, IconName> = { system: "monitor", light: "sun", dark: "moon" };

/** Chọn ngôn ngữ + chế độ màu, dạng khối (dùng trong Hồ sơ và trong menu bật lên). */
export function PrefsControls() {
  const { lang, setLang, theme, setTheme, t } = usePrefs();
  return (
    <div className="stack">
      <div>
        <span className="label">{t("prefs.language")}</span>
        <div className="seg">
          {LANGS.map((l) => (
            <button type="button" key={l.id} className={lang === l.id ? "active" : ""} onClick={() => setLang(l.id)} lang={l.id}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">{t("prefs.theme")}</span>
        <div className="seg">
          {THEMES.map((th) => (
            <button type="button" key={th} className={theme === th ? "active" : ""} onClick={() => setTheme(th)}>
              <Icon name={THEME_ICON[th]} size={16} />
              <span>{t(`theme.${th}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Nút bánh răng mở menu nhỏ chứa PrefsControls. `placement` quyết định menu bật lên trên hay xuống dưới. */
export default function PrefsMenu({ placement = "up", className = "" }: { placement?: "up" | "down"; className?: string }) {
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`popover-wrap ${className}`} ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={t("prefs.title")}
        title={t("prefs.title")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="settings" size={18} />
      </button>
      {open && (
        <div className={`popover ${placement}`} role="dialog" aria-label={t("prefs.title")}>
          <b className="popover-title">{t("prefs.title")}</b>
          <PrefsControls />
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useT } from "../i18n";
import { canPrompt, isIos, isStandalone, onInstallChange, promptInstall } from "../lib/pwa";
import Icon from "./Icon";

/** Nút cài app lên màn hình chính; ẩn khi đã cài hoặc trình duyệt không hỗ trợ. */
export default function InstallApp() {
  const t = useT();
  const [available, setAvailable] = useState(canPrompt);
  useEffect(() => onInstallChange(() => setAvailable(canPrompt())), []);

  if (isStandalone()) return null;
  if (!available && !isIos()) return null;

  return (
    <section className="card stack">
      <h2>
        <Icon name="download" size={18} /> {t("pwa.title")}
      </h2>
      <p className="muted small">{t("pwa.desc")}</p>
      {available ? (
        <button className="btn primary" onClick={() => void promptInstall()}>
          {t("pwa.install")}
        </button>
      ) : (
        <p className="hint">{t("pwa.ios")}</p>
      )}
    </section>
  );
}

// Cài app (PWA): đăng ký service worker và giữ sự kiện "beforeinstallprompt" để hiện nút Cài đặt khi cần.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function setupPwa() {
  // Chỉ đăng ký ở bản build: khi dev, service worker giữ file cũ làm Vite hot reload sai
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* trình duyệt chặn service worker: app vẫn chạy bình thường khi có mạng */
      });
    });
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const canPrompt = () => deferred != null;

export function onInstallChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Mở hộp thoại cài app của trình duyệt (Chrome, Edge, Android). */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  return (await e.userChoice).outcome === "accepted";
}

/** Đang chạy như app đã cài (mở từ màn hình chính). */
export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone/iPad: Safari không có hộp thoại cài, phải dùng "Thêm vào MH chính". */
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

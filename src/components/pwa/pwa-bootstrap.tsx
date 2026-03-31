"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

const ENABLE_SW_IN_DEV = process.env.NEXT_PUBLIC_ENABLE_SW_DEV === "true";
const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SHOW_DELAY_MS = 5000;

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function recordDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch { /* ignore */ }
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|opios|edgios/i.test(ua);
}

function isMobile() {
  if (typeof window === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// ── Shared shell ─────────────────────────────────────────────────────────────

function InstallBanner({
  onDismiss,
  children,
}: {
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      // Bottom-right on desktop, bottom-center on mobile
      className="pointer-events-auto fixed z-50 w-[calc(100%-2rem)] max-w-sm sm:w-auto sm:max-w-xs"
      style={{
        bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
        right: "1.25rem",
        left: "auto",
      }}
    >
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/20 bg-[#0D1F45]/95 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-md">
        {/* Subtle gradient shimmer */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-violet-500/10" />

        {/* App icon */}
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-inner">
          <span className="text-base font-black text-white">K</span>
        </div>

        {/* Text */}
        <div className="relative min-w-0 flex-1">{children}</div>

        {/* Dismiss */}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="relative shrink-0 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white/80"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PwaBootstrap() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  const canRegisterServiceWorker = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator)) return false;
    return process.env.NODE_ENV === "production" || ENABLE_SW_IN_DEV;
  }, []);

  // Service worker registration
  useEffect(() => {
    if (!canRegisterServiceWorker) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
      console.error("[pwa] SW registration failed:", e);
    });
  }, [canRegisterServiceWorker]);

  // iOS Safari: show install instructions after delay
  useEffect(() => {
    if (isStandaloneMode()) { setIsStandalone(true); return; }
    if (!isIosSafari() || isDismissed()) return;
    const t = setTimeout(() => { setShowIosBanner(true); setVisible(true); }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Chrome/Android/Desktop: capture beforeinstallprompt, show after delay
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (isDismissed()) return;
      const promptEvent = event as BeforeInstallPromptEvent;
      setInstallPromptEvent(promptEvent);
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };
    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setVisible(false);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    recordDismiss();
    setVisible(false);
    setShowIosBanner(false);
  }

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {/* iOS Safari instructions */}
      {showIosBanner && visible && (
        <InstallBanner key="ios" onDismiss={dismiss}>
          <p className="text-[13px] font-semibold leading-tight text-white">Add KAT to Home Screen</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">
            Tap{" "}
            <span className="inline-flex items-center gap-0.5 font-medium text-white/80">
              <Share className="size-3" /> Share
            </span>
            {" "}then{" "}
            <span className="font-medium text-white/80">"Add to Home Screen"</span>
          </p>
        </InstallBanner>
      )}

      {/* Chrome / Desktop install prompt */}
      {installPromptEvent && visible && !showIosBanner && (
        <InstallBanner key="install" onDismiss={dismiss}>
          <p className="text-[13px] font-semibold leading-tight text-white">
            {isMobile() ? "Add KAT to Home Screen" : "Install KAT"}
          </p>
          <p className="mt-0.5 text-[11px] text-white/55">
            {isMobile() ? "Works offline, loads faster" : "Open as a desktop app"}
          </p>
          <button
            onClick={async () => {
              try {
                setInstalling(true);
                await installPromptEvent.prompt();
                const { outcome } = await installPromptEvent.userChoice;
                if (outcome === "accepted") {
                  setInstallPromptEvent(null);
                  setVisible(false);
                } else {
                  dismiss();
                }
              } finally {
                setInstalling(false);
              }
            }}
            disabled={installing}
            className="mt-2 flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/25 active:scale-95 disabled:opacity-60"
          >
            <Download className="size-3.5" />
            {installing ? "Installing…" : "Install"}
          </button>
        </InstallBanner>
      )}
    </AnimatePresence>
  );
}

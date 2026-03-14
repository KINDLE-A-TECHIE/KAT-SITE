"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  } catch {
    // localStorage unavailable (private mode, storage full) — fail silently
  }
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // Safari on iOS: has "Safari" but not "CriOS" (Chrome) or "FxiOS" (Firefox)
  const isSafari = /safari/i.test(ua) && !/crios|fxios|opios|edgios/i.test(ua);
  return isIos && isSafari;
}

export function PwaBootstrap() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);

  const canRegisterServiceWorker = useMemo(() => {
    if (typeof window === "undefined") return false;
    if (!("serviceWorker" in navigator)) return false;
    return process.env.NODE_ENV === "production" || ENABLE_SW_IN_DEV;
  }, []);

  useEffect(() => {
    const standalone = isStandaloneMode();
    setIsStandalone(standalone);
    if (!standalone && isIosSafari() && !isDismissed()) {
      setShowIosBanner(true);
    }
  }, []);

  useEffect(() => {
    if (!canRegisterServiceWorker) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("[pwa] Service worker registration failed:", error);
      }
    };
    void register();
  }, [canRegisterServiceWorker]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isDismissed()) {
        setInstallPromptEvent(event as BeforeInstallPromptEvent);
      }
    };
    const handleAppInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isStandalone) return null;

  // iOS Safari banner
  if (showIosBanner) {
    return (
      <div
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0D1F45]">
            {/* Share icon matches Safari's share sheet icon */}
            <Share className="size-4 text-blue-300" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-slate-900">Add KAT to your home screen</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Tap the{" "}
              <span className="inline-flex items-center gap-0.5 font-medium text-slate-700">
                <Share className="inline size-3" /> Share
              </span>{" "}
              button, then choose <span className="font-medium text-slate-700">"Add to Home Screen"</span>.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => { recordDismiss(); setShowIosBanner(false); }}
            className="mt-0.5 shrink-0 rounded-md p-0.5 text-slate-400 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  // Android / Chrome install prompt
  if (!installPromptEvent) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
        <Button
          size="sm"
          className="rounded-full"
          disabled={installing}
          onClick={async () => {
            try {
              setInstalling(true);
              await installPromptEvent.prompt();
              const result = await installPromptEvent.userChoice;
              if (result.outcome === "accepted") {
                setInstallPromptEvent(null);
              } else {
                recordDismiss();
                setInstallPromptEvent(null);
              }
            } finally {
              setInstalling(false);
            }
          }}
        >
          <Download className="mr-1.5 size-4" />
          {installing ? "Installing..." : "Install App"}
        </Button>
      </div>
    </div>
  );
}

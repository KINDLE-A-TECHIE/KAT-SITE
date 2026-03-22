"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: string;
          size?: string;
          retry?: "auto" | "never";
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type Props = {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
};

export function TurnstileWidget({ siteKey, onSuccess, onExpire, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderWidget = () => {
      if (!container || !window.turnstile) return;
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: "light",
        size: "flexible",
        retry: "never",
        callback: onSuccess,
        "error-callback": onError,
        "expired-callback": onExpire,
      });
    };

    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Script not yet loaded — poll until it is
    const interval = setInterval(() => {
      if (window.turnstile) {
        clearInterval(interval);
        renderWidget();
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* ignore */ }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onSuccess, onExpire, onError]);

  return <div ref={containerRef} />;
}

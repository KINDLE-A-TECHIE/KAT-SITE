"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser connectivity. SSR-safe: assumes online until mounted so nothing flashes on the server
 * render. Mirrors the resilience of ConnectivityBanner, the `online` event is not always delivered on
 * flaky mobile networks (the norm in the unstable-connectivity setting), so it also re-checks on tab focus.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return online;
}

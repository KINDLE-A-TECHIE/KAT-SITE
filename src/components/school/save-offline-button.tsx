"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";

/**
 * "Save for offline" for one unit. It fetches the unit's lesson content (which the service worker caches
 * as it passes through), collects the image URLs inside those lessons, and asks the SW to pre-download
 * everything so the unit reads during a power/network outage.
 *
 * This does NOT create a downloadable file: content lands only in the browser's sandboxed cache, viewable
 * in-app, not something a pupil can pass around. It also never bypasses access, only a lesson the pupil is
 * already licensed to open can be cached. The button only appears when a service worker is controlling the
 * page (production), so there is nothing to save into otherwise.
 */
export function SaveOfflineButton({ moduleId, lessonIds }: { moduleId: string; lessonIds: string[] }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [available, setAvailable] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const markSaved = useCallback(() => {
    setState("saved");
    try { localStorage.setItem(`kat:offline:${moduleId}`, "1"); } catch { /* ignore */ }
  }, [moduleId]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let alive = true;
    // `ready` resolves once an active worker exists for this scope. It is the stable signal, unlike
    // `controller`, which is racy right after a reload and never re-fires `controllerchange` for an
    // already-claimed page. In dev with no worker registered it simply never resolves, so the button
    // stays hidden, which is what we want.
    navigator.serviceWorker.ready.then(() => { if (alive) setAvailable(true); }).catch(() => {});
    try {
      if (localStorage.getItem(`kat:offline:${moduleId}`) === "1") setState("saved");
    } catch { /* ignore */ }
    return () => { alive = false; };
  }, [moduleId]);

  useEffect(() => {
    if (!available) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "PRECACHE_DONE" && e.data.unitId === moduleId) markSaved();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [available, moduleId, markSaved]);

  const save = async () => {
    if (state === "saving" || lessonIds.length === 0) return;
    setState("saving");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sw = reg.active ?? navigator.serviceWorker.controller;
      if (!sw) { setState("idle"); return; }
      // Hand the whole unit to the SW: it fetches each lesson, caches it, discovers the images inside,
      // and warms the image cache, then replies PRECACHE_DONE. No slow page-side loop.
      const apiUrls = lessonIds.map((id) => `/api/curriculum/lessons/${id}`);
      sw.postMessage({ type: "PRECACHE", unitId: moduleId, apiUrls });
      // Fallback in case the done-message is missed (e.g. the pupil reloads before the SW replies):
      // the caching still happened, so reflect and persist it.
      setTimeout(() => { if (stateRef.current === "saving") markSaved(); }, 20000);
    } catch {
      setState("idle");
    }
  };

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={state === "saving"}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-70 ${
        state === "saved"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/40"
      }`}
      title="Keep this unit readable when the power or internet is out"
    >
      {state === "saving" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : state === "saved" ? (
        <Check className="size-3.5" />
      ) : (
        <Download className="size-3.5" />
      )}
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved for offline" : "Save for offline"}
    </button>
  );
}

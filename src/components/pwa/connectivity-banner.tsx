"use client";

import { useEffect, useState } from "react";
import { Check, CloudOff } from "lucide-react";
import { flushCompletions, pendingCount, subscribePending, subscribeSynced } from "@/lib/offline-completions";
import { flushDrafts, pendingDraftCount, subscribeDrafts } from "@/lib/lesson-block-draft";

/**
 * A slim, unobtrusive connection indicator for the unstable-power/connectivity setting. It stays out of
 * the way while online, shows a calm "you're offline" pill during an outage (with how many changes are
 * waiting to sync: queued lesson completions plus unsynced interactive-block drafts), and, when the
 * connection returns, replays them and briefly confirms the completions. No colour beyond the warm
 * amber/emerald the design system already uses.
 */
export function ConnectivityBanner() {
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [justSynced, setJustSynced] = useState(0);

  useEffect(() => {
    setMounted(true);
    setOnline(navigator.onLine);

    // Pending = queued lesson completions (localStorage, sync) + dirty interactive-block drafts
    // (IndexedDB, async). Recompute on any change to either.
    let alive = true;
    const recompute = () => {
      void pendingDraftCount().then((drafts) => {
        if (alive) setPending(pendingCount() + drafts);
      });
    };
    recompute();

    const unsubPending = subscribePending(recompute);
    const unsubDrafts = subscribeDrafts(recompute);
    // Confirm a sync however it was triggered: the lesson viewer also drains the completion queue, and
    // whichever flusher wins the race, the pupil should see the same "synced" confirmation.
    const unsubSynced = subscribeSynced((n) => {
      setJustSynced(n);
      setTimeout(() => setJustSynced(0), 6000);
    });

    // Drain both queues when we have reason to think we are back. Safe to call often (idempotent, and
    // each flusher no-ops when there is nothing pending or we are offline).
    const tryFlush = () => {
      if (!navigator.onLine) return;
      void flushCompletions();
      void flushDrafts();
    };

    const onOnline = () => { setOnline(true); tryFlush(); };
    const onOffline = () => setOnline(false);
    const onVisible = () => { if (document.visibilityState === "visible") { setOnline(navigator.onLine); tryFlush(); } };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    // The `online` event is not always delivered (flaky mobile networks, backgrounded tabs), which is
    // the norm in this setting. A light poll while anything is queued guarantees it eventually syncs.
    const interval = window.setInterval(tryFlush, 15000);

    tryFlush(); // catch anything queued in a previous session

    return () => {
      alive = false;
      unsubPending();
      unsubDrafts();
      unsubSynced();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, []);

  // Nothing to show while online and nothing recently synced.
  if (!mounted || (online && justSynced === 0)) return null;

  if (online && justSynced > 0) {
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Check className="size-4 shrink-0" />
          Back online. Synced {justSynced} lesson{justSynced === 1 ? "" : "s"}.
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 print:hidden">
      <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <CloudOff className="size-4 shrink-0" />
        You&apos;re offline.
        <span className="font-normal text-amber-700 dark:text-amber-300/90">
          {pending > 0
            ? `${pending} change${pending === 1 ? "" : "s"} will sync when you're back.`
            : "Saved lessons still open."}
        </span>
      </div>
    </div>
  );
}

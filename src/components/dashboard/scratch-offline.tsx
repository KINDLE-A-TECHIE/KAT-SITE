"use client";

import { CloudOff } from "lucide-react";

/**
 * Shown in place of the Scratch iframe when the pupil is offline and the editor has not loaded yet.
 *
 * Scratch runs in KAT's self-hosted editor on a SEPARATE origin, loaded in a cross-origin iframe. The KAT
 * service worker only caches its own origin, so it cannot serve that iframe offline, and the editor's
 * cloud save/open goes through R2 and a KAT API route. So Scratch is online-only by design (Blockly is the
 * offline-capable block). Rather than let the iframe fail silently, we say so plainly and reassure the
 * pupil their saved work is safe. It reloads on its own when the connection returns.
 */
export function ScratchOfflinePanel({ heightClass = "h-[34rem]" }: { heightClass?: string }) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-6 text-center dark:border-amber-900/50 dark:bg-amber-950/20 ${heightClass}`}
    >
      <CloudOff className="size-8 text-amber-500 dark:text-amber-400" />
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Scratch needs an internet connection</p>
      <p className="max-w-sm text-xs text-amber-700 dark:text-amber-300/90">
        The Scratch editor runs online, so it cannot open while you are offline. Anything you have already
        saved is safe. This will load on its own when you are back online.
      </p>
    </div>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Shared behaviour for an editor's "fill the screen" mode: while active, Escape exits and the page body
 * cannot scroll behind the overlay. The overlay itself is plain CSS (a `fixed inset` panel + backdrop, the
 * same pattern the code playground already uses), so it works identically for a same-origin editor
 * (Blockly, Monaco) and a cross-origin iframe (Scratch), with no Fullscreen-API permission quirks.
 */
export function useFullscreen(active: boolean, onExit: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [active, onExit]);
}

/** The panel + backdrop classes for the fullscreen overlay, matching the code playground's look. */
export const FULLSCREEN_PANEL_CLASS =
  "fixed inset-1 z-[60] flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white p-3 shadow-2xl dark:border-stone-800 dark:bg-stone-950 sm:inset-4 md:inset-8";
export const FULLSCREEN_BACKDROP_CLASS = "fixed inset-0 z-[59] bg-black/40";

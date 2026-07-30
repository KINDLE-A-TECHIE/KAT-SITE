"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Users } from "lucide-react";

/**
 * A teacher records that their class finished this digital-literacy lesson from the front of the room,
 * so it counts as complete for the pupils who did it together rather than each on a device. Only shown
 * for DIGLIT lessons (the page gates it); confirms first, since it writes progress for the whole class.
 */
export function DiglitClassComplete({
  classId,
  lessonId,
  pupilCount,
}: {
  classId: string;
  lessonId: string;
  pupilCount: number;
}) {
  const [state, setState] = useState<"idle" | "confirm" | "saving" | "done">("idle");

  if (pupilCount === 0) return null; // no roster yet, nothing to complete

  const submit = async () => {
    setState("saving");
    try {
      const res = await fetch("/api/school/teach/complete-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, lessonId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error ?? "Could not mark the lesson complete.");
        setState("idle");
        return;
      }
      toast.success(`Marked complete for ${payload.pupils} pupil${payload.pupils === 1 ? "" : "s"}.`);
      setState("done");
    } catch {
      toast.error("Could not mark the lesson complete.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
        <Check className="size-3.5" />
        Class marked complete
      </span>
    );
  }

  if (state === "confirm" || state === "saving") {
    const busy = state === "saving";
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs text-stone-500 dark:text-stone-400">
          Mark done for {pupilCount} pupil{pupilCount === 1 ? "" : "s"}?
        </span>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-70"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setState("idle")}
          disabled={busy}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 transition hover:text-stone-700 disabled:opacity-70 dark:text-stone-400"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState("confirm")}
      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/40"
    >
      <Users className="size-3.5" />
      Mark class complete
    </button>
  );
}

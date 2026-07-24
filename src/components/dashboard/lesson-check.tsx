"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { CheckOption } from "@/lib/lesson-interactions";

/**
 * A formative, self-marked check question inside a lesson note: the child taps an answer and gets
 * immediate feedback. It is NOT graded and writes nothing, so the answer living client-side is by
 * design (unlike the capstone/quiz gates, which are server-verified).
 */
export function LessonCheck({
  question,
  options,
  explanation,
}: {
  question: string;
  options: CheckOption[];
  explanation: string | null;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const gotIt = answered && options[picked].correct;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-5 dark:border-orange-900/40 dark:bg-orange-950/20">
      <p className="mb-3 flex items-start gap-2 text-base font-semibold text-stone-800 dark:text-stone-100">
        <span className="mt-0.5 shrink-0 rounded-md bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Check
        </span>
        <span>{question}</span>
      </p>

      <div className="space-y-2">
        {options.map((o, k) => {
          const chosen = picked === k;
          const showCorrect = answered && o.correct;
          const showWrong = chosen && !o.correct;
          return (
            <button
              key={k}
              type="button"
              onClick={() => !answered && setPicked(k)}
              disabled={answered}
              aria-pressed={chosen}
              className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                showCorrect
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : showWrong
                    ? "border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-stone-200 bg-white text-stone-700 hover:border-orange-300 hover:bg-orange-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
              } ${answered ? "cursor-default" : "cursor-pointer"}`}
            >
              {showCorrect ? (
                <Check className="size-4 shrink-0 text-emerald-600" />
              ) : showWrong ? (
                <X className="size-4 shrink-0 text-rose-500" />
              ) : (
                <span className="size-4 shrink-0 rounded-full border border-stone-300 dark:border-stone-600" />
              )}
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <p className={`mt-3 text-sm ${gotIt ? "text-emerald-700 dark:text-emerald-400" : "text-stone-600 dark:text-stone-300"}`}>
          <strong>{gotIt ? "Correct. " : "Not quite. "}</strong>
          {explanation || (gotIt ? "Nice work." : "Have another look and try again.")}
        </p>
      )}
    </div>
  );
}

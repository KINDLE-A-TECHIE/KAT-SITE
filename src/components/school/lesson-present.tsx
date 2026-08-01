"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { ChevronLeft, ChevronRight, Projector, X } from "lucide-react";
import "katex/dist/katex.min.css";
import { splitIntoSlides } from "@/lib/lesson-slides";
import { parseNoteSegments } from "@/lib/lesson-interactions";
import { renderMathToHtml } from "@/lib/lesson-math";
import { LessonCheck } from "@/components/dashboard/lesson-check";
import type { ContentItem } from "@/components/dashboard/lesson-viewer";

type Segment = ReturnType<typeof parseNoteSegments>[number];
type Slide = { heading: string | null; segments: Segment[] };

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
  });
}

// Projector-scale typography: big display headings, roomy body, the same warm accents as the on-screen
// slide deck so what a teacher presents matches what a pupil reads.
const PROSE =
  "prose prose-stone dark:prose-invert prose-xl sm:prose-2xl max-w-none prose-headings:font-display " +
  "prose-p:leading-relaxed prose-li:marker:text-orange-500 prose-a:text-orange-600 " +
  "prose-strong:text-stone-900 dark:prose-strong:text-stone-100 " +
  "prose-img:mx-auto prose-img:rounded-xl prose-img:shadow-md prose-img:max-h-[55vh] " +
  "[&_table]:w-full [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:px-3 [&_td]:py-2 [&_td]:align-top";

/**
 * Teacher-led present mode: a fullscreen, keyboard-navigable slide deck of a lesson's notes, for
 * delivering a digital-literacy unit from the front of the room on a projector. It reuses the exact
 * slide engine the pupil sees (splitIntoSlides + note segments + KaTeX + inline checks), just at a
 * larger scale, so the class sees the same material. Non-note content (video, code) is not part of a
 * projected deck; the teacher opens those directly.
 */
export function LessonPresent({ lessonTitle, contents }: { lessonTitle: string; contents: ContentItem[] }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasNotes = contents.some((c) => c.type === "RICH_TEXT" && c.body);

  // DOMPurify needs a DOM, so build the slides only after mount (by which point the teacher has to
  // have clicked to open anyway). Each RICH_TEXT note contributes its slides, in lesson order.
  const slides: Slide[] = useMemo(() => {
    if (!mounted) return [];
    const out: Slide[] = [];
    for (const c of contents) {
      if (c.type !== "RICH_TEXT" || !c.body) continue;
      for (const s of splitIntoSlides(sanitize(c.body))) {
        const segments = parseNoteSegments(s.html).map((seg) =>
          seg.kind === "html" ? { ...seg, html: renderMathToHtml(seg.html) } : seg,
        );
        out.push({ heading: s.heading, segments });
      }
    }
    return out;
  }, [contents, mounted]);

  const count = slides.length;
  const idx = Math.min(i, Math.max(0, count - 1));

  const closePresent = () => {
    setOpen(false);
    try {
      if (document.fullscreenElement) void document.exitFullscreen?.();
    } catch {
      /* ignore */
    }
  };

  const openPresent = () => {
    setI(0);
    setOpen(true);
    // Best-effort real fullscreen (this runs inside the button's click gesture, so it is allowed).
    try {
      void document.documentElement.requestFullscreen?.();
    } catch {
      /* windowed overlay is a fine fallback */
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setI((n) => Math.min(n + 1, count - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setI((n) => Math.max(n - 1, 0));
      } else if (e.key === "Home") {
        setI(0);
      } else if (e.key === "End") {
        setI(count - 1);
      } else if (e.key === "Escape") {
        closePresent();
      }
    };
    // Leaving browser fullscreen (the usual first Esc) should close the deck too, so one Esc is enough.
    const onFs = () => { if (!document.fullscreenElement) setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [open, count]);

  if (!hasNotes) return null;

  return (
    <>
      <button
        type="button"
        onClick={openPresent}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/40"
      >
        <Projector className="size-3.5" />
        Present to class
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--kat-paper,#faf7f2)] text-stone-900 dark:bg-stone-950 dark:text-stone-100">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-3 dark:border-stone-800">
            <p className="min-w-0 truncate font-display text-sm font-semibold sm:text-base">{lessonTitle}</p>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs tabular-nums text-stone-400">
                {count > 0 ? `${idx + 1} / ${count}` : "0 / 0"}
              </span>
              <button
                type="button"
                onClick={closePresent}
                aria-label="Exit present mode"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                <X className="size-4" />
                Exit
              </button>
            </div>
          </div>

          {/* Slide */}
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-8 sm:px-16">
            <div className="mx-auto w-full max-w-4xl space-y-6">
              {count === 0 ? (
                <p className="text-center text-stone-400">This lesson has no slides to present.</p>
              ) : (
                <>
                  {slides[idx].heading ? (
                    <h1 className="font-display text-3xl font-bold leading-tight sm:text-5xl">
                      {slides[idx].heading}
                    </h1>
                  ) : null}
                  {slides[idx].segments.map((seg, k) =>
                    seg.kind === "check" ? (
                      <div key={k} className="text-lg">
                        <LessonCheck question={seg.question} options={seg.options} explanation={seg.explanation} />
                      </div>
                    ) : (
                      <div
                        key={k}
                        className={`${PROSE} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}
                        dangerouslySetInnerHTML={{ __html: seg.html }}
                      />
                    ),
                  )}
                </>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3 border-t border-stone-200 px-5 py-4 dark:border-stone-800">
            <button
              type="button"
              onClick={() => setI((n) => Math.max(n - 1, 0))}
              disabled={idx === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 disabled:opacity-40 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              <ChevronLeft className="size-4" /> Back
            </button>
            <p className="hidden text-xs text-stone-400 sm:block">
              Arrow keys or space to move. Esc to exit.
            </p>
            <button
              type="button"
              onClick={() => setI((n) => Math.min(n + 1, count - 1))}
              disabled={idx >= count - 1}
              className="inline-flex items-center gap-1.5 rounded-lg bg-kat-clay px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-kat-clay-deep disabled:opacity-40"
            >
              Next <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

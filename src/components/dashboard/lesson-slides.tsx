"use client";

import { useEffect, useMemo, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "katex/dist/katex.min.css";
import { splitIntoSlides } from "@/lib/lesson-slides";
import { parseNoteSegments } from "@/lib/lesson-interactions";
import { renderMathToHtml } from "@/lib/lesson-math";
import { LessonCheck } from "@/components/dashboard/lesson-check";
import { LessonImageLightbox } from "@/components/dashboard/lesson-image-lightbox";

// Reveal is opacity + translateY only (GPU-cheap for low-end devices). MotionConfig reducedMotion
// "user" makes all of this instant for anyone with prefers-reduced-motion, no manual checks.
const container = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } } };
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 0.61, 0.36, 1] as const } },
};

// Slide-grade typography from the warm design system: display headings, roomy body, accent bullets.
const PROSE =
  "prose prose-stone dark:prose-invert prose-lg max-w-none prose-headings:font-display " +
  "prose-p:leading-relaxed prose-li:marker:text-orange-500 prose-a:text-orange-600 " +
  "prose-strong:text-stone-900 dark:prose-strong:text-stone-100 " +
  // Images read like a slide picture: centered, rounded, softly shadowed, with a centered caption.
  "prose-img:mx-auto prose-img:rounded-xl prose-img:shadow-md prose-img:cursor-zoom-in prose-figure:my-2 " +
  "prose-figcaption:text-center prose-figcaption:text-stone-500 " +
  // Tables: clear header rule, roomy cells, row separators (prose's default is cramped for kids).
  // Arbitrary-variant selectors (real specificity) rather than prose-th:/prose-td: modifiers, whose
  // :where()-based rules were not overriding the browser's default cramped table cells here.
  "[&_table]:my-3 [&_table]:w-full [&_table]:text-[0.95em] " +
  "[&_thead]:border-b-2 [&_thead]:border-stone-200 dark:[&_thead]:border-stone-700 " +
  "[&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold " +
  "[&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:border-t [&_td]:border-stone-100 dark:[&_td]:border-stone-800";

// Wraps each <table> in a horizontal-scroll container so a wide table scrolls inside the slide on a
// small screen instead of breaking the page layout (the CLAUDE.md wide-content rule).
function withScrollableTables(html: string): string {
  return html.replace(/<table\b/gi, '<div class="overflow-x-auto"><table').replace(/<\/table>/gi, "</table></div>");
}

/**
 * Renders a lesson note as an animated slide deck instead of a textbook wall: one idea per screen,
 * each element rising in as the child reaches the slide, with slide paging when the note has sections.
 * `html` must already be sanitized (the caller sanitizes). Used only for learners; creators editing
 * still see the plain outline.
 */
export function LessonSlides({ html }: { html: string }) {
  // Pure + deterministic, so SSR and client agree (no hydration dance).
  const slides = useMemo(() => splitIntoSlides(html), [html]);
  const [i, setI] = useState(0);
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => { setI(0); }, [html]); // back to slide 1 when the note changes

  // Delegated: tapping any note image opens the zoom viewer (the images live in dangerouslySetInnerHTML,
  // so there is no per-image React handler to attach). Links and everything else pass through.
  const onDeckClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.tagName === "IMG") {
      const img = el as HTMLImageElement;
      setZoomImage({ src: img.currentSrc || img.src, alt: img.alt });
    }
  };

  const many = slides.length > 1;
  const idx = Math.min(i, slides.length - 1);
  const slide = slides[idx];
  // Inline checks become interactive widgets; the rest is prose with its TeX pre-rendered to KaTeX and
  // its tables made horizontally scrollable. Doing both here (in render output, memoized per slide)
  // keeps the result stable across re-renders. Each segment is a reveal beat.
  const segments = useMemo(
    () =>
      parseNoteSegments(slide.html).map((seg) =>
        seg.kind === "html" ? { ...seg, html: withScrollableTables(renderMathToHtml(seg.html)) } : seg,
      ),
    [slide.html],
  );
  const go = (n: number) => setI(Math.max(0, Math.min(n, slides.length - 1)));

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-3xl">
        <div
          onClick={onDeckClick}
          className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white px-5 py-7 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:px-9 sm:py-9"
        >
          {/* key={idx} remounts on paging so the reveal replays; whileInView fires it the moment the
              step becomes visible in the player (the note starts hidden until the child reaches it). */}
          <motion.div
            key={idx}
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: false, amount: 0.2 }}
            className="min-h-[200px] space-y-4"
          >
            {slide.heading && (
              <motion.h2
                variants={item}
                className="font-display text-2xl font-bold leading-tight text-stone-900 dark:text-stone-100 sm:text-[2rem]"
              >
                {slide.heading}
              </motion.h2>
            )}
            {segments.map((seg, k) =>
              seg.kind === "check" ? (
                <motion.div key={k} variants={item}>
                  <LessonCheck question={seg.question} options={seg.options} explanation={seg.explanation} />
                </motion.div>
              ) : (
                <motion.div
                  key={k}
                  variants={item}
                  className={`${PROSE} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}
                  dangerouslySetInnerHTML={{ __html: seg.html }}
                />
              ),
            )}
          </motion.div>

          {many && (
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-stone-100 pt-4 dark:border-stone-800">
              <button
                onClick={() => go(idx - 1)}
                disabled={idx === 0}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 disabled:opacity-40 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                <ChevronLeft className="size-4" /> Back
              </button>
              <div className="flex items-center gap-1.5">
                {slides.map((_, d) => (
                  <button
                    key={d}
                    onClick={() => go(d)}
                    aria-label={`Slide ${d + 1} of ${slides.length}`}
                    aria-current={d === idx ? "true" : undefined}
                    className={`h-2 rounded-full transition-all ${d === idx ? "w-5 bg-orange-500" : "w-2 bg-stone-300 hover:bg-stone-400 dark:bg-stone-700"}`}
                  />
                ))}
              </div>
              <button
                onClick={() => go(idx + 1)}
                disabled={idx === slides.length - 1}
                className="inline-flex items-center gap-1 rounded-lg bg-kat-clay px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-kat-clay-deep disabled:opacity-40"
              >
                Next <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
        {many && (
          <p className="mt-2 text-center font-mono text-[11px] tabular-nums text-stone-400">
            {idx + 1} / {slides.length}
          </p>
        )}
      </div>
      {zoomImage && (
        <LessonImageLightbox src={zoomImage.src} alt={zoomImage.alt} onClose={() => setZoomImage(null)} />
      )}
    </MotionConfig>
  );
}

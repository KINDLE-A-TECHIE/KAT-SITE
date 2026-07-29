"use client";

import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Printer, KeyRound } from "lucide-react";
import "katex/dist/katex.min.css";
import { parseNoteSegments } from "@/lib/lesson-interactions";
import { renderMathToHtml } from "@/lib/lesson-math";

export type WorksheetContent = {
  type: string;
  title: string;
  body: string | null;
};

type Question = { question: string; options: { text: string; correct: boolean }[] };

const PROSE =
  "prose prose-stone prose-sm max-w-none prose-headings:font-semibold prose-p:my-2 " +
  "prose-headings:mt-3 prose-headings:mb-1 prose-img:mx-auto prose-img:my-2 prose-img:max-h-56";

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
  });
}

/**
 * A print-optimized worksheet for a lesson, so a teacher can print a unit and the class can do it on
 * paper. This is the reliable "works with no power and no internet" path for classrooms: the notes
 * render as static prose, and inline "Check:" questions become numbered multiple-choice items with
 * lettered options. An answer-key toggle (teacher-only, hidden on the pupil copy) marks the answers.
 *
 * Reuses the same note parser and math renderer as the on-screen slide view, so what prints matches
 * what is taught. Interactive blocks (code, network lab) cannot go on paper, so they show a short note.
 */
export function LessonWorksheet({
  lessonTitle,
  subtitle,
  contents,
}: {
  lessonTitle: string;
  subtitle: string;
  contents: WorksheetContent[];
}) {
  const [showAnswers, setShowAnswers] = useState(false);
  // DOMPurify needs a DOM, so it must not run during SSR. Compute the body only after mount (client),
  // which is fine for a print tool: the page fills in before the teacher hits Print.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Flatten every note into ordered blocks: prose HTML or a numbered question. Question numbers run
  // across the whole worksheet. Memoized so DOMPurify/KaTeX run once, not on the answer-key toggle.
  const blocks = useMemo(() => {
    const out: ({ kind: "html"; html: string } | { kind: "q"; n: number; q: Question } | { kind: "skip"; label: string })[] = [];
    if (!mounted) return out;
    let n = 0;
    for (const c of contents) {
      if (c.type !== "RICH_TEXT" || !c.body) {
        out.push({ kind: "skip", label: c.title });
        continue;
      }
      for (const seg of parseNoteSegments(sanitize(c.body))) {
        if (seg.kind === "check") {
          n += 1;
          out.push({ kind: "q", n, q: { question: seg.question, options: seg.options } });
        } else {
          out.push({ kind: "html", html: renderMathToHtml(seg.html) });
        }
      }
    }
    return out;
  }, [contents, mounted]);

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 16mm 14mm; }
        @media print {
          html, body { background: #fff !important; }
          #ws-toolbar { display: none !important; }
          .ws-question, .ws-block { break-inside: avoid; }
        }
      `}</style>

      {/* Toolbar (screen only) */}
      <div id="ws-toolbar" className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-kat-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800"
        >
          <Printer className="size-4" /> Print / Save PDF
        </button>
        <button
          type="button"
          onClick={() => setShowAnswers((v) => !v)}
          aria-pressed={showAnswers}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
            showAnswers
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <KeyRound className="size-4" />
          {showAnswers ? "Answer key on" : "Show answer key"}
        </button>
        <p className="ml-auto text-xs text-stone-400">
          Print the pupil copy with the answer key off; turn it on for your own marking copy.
        </p>
      </div>

      {/* The printable sheet */}
      <div className="mx-auto max-w-[210mm] rounded-lg border border-stone-200 bg-white p-8 text-stone-900 shadow-sm print:border-0 print:shadow-none">
        {/* Header */}
        <div className="border-b border-stone-300 pb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400">
            KAT Worksheet{showAnswers ? " · Answer key" : ""}
          </p>
          <h1 className="mt-1 font-display text-xl font-bold">{lessonTitle}</h1>
          <p className="text-sm text-stone-500">{subtitle}</p>
          {!showAnswers ? (
            <div className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm text-stone-600">
              <span>Name: <span className="inline-block w-48 border-b border-stone-400" /></span>
              <span>Class: <span className="inline-block w-28 border-b border-stone-400" /></span>
              <span>Date: <span className="inline-block w-28 border-b border-stone-400" /></span>
            </div>
          ) : null}
        </div>

        {/* Body */}
        <div className="mt-4 space-y-1">
          {blocks.map((b, i) => {
            if (b.kind === "html") {
              return (
                <div
                  key={i}
                  className={`ws-block ${PROSE}`}
                  dangerouslySetInnerHTML={{ __html: b.html }}
                />
              );
            }
            if (b.kind === "skip") {
              return (
                <p key={i} className="ws-block my-2 rounded border border-dashed border-stone-300 px-3 py-2 text-xs text-stone-500">
                  Interactive activity: <span className="font-medium">{b.label}</span>. Complete this one on a device.
                </p>
              );
            }
            return (
              <div key={i} className="ws-question mt-3">
                <p className="font-medium">
                  <span className="mr-1.5 font-bold">{b.n}.</span>
                  {b.q.question}
                </p>
                <ol className="mt-1 space-y-1 pl-6 text-sm" type="A">
                  {b.q.options.map((o, k) => (
                    <li
                      key={k}
                      className={showAnswers && o.correct ? "font-semibold text-emerald-700" : "text-stone-700"}
                    >
                      {o.text}
                      {showAnswers && o.correct ? " ✓" : ""}
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

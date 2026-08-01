export type CheckOption = { text: string; correct: boolean };
export type Segment =
  | { kind: "html"; html: string }
  | { kind: "check"; question: string; options: CheckOption[]; explanation: string | null };

// An inline check: a paragraph "Check: <question>" followed by a list whose correct option(s) end
// with a check mark, and an optional "Because: <explanation>" paragraph. Authorable in a plain
// editor (type "Check:", a bullet list, a check mark on the right answer), rendered as an interactive
// tap-to-answer widget. This is a formative self-check, NOT a graded quiz, so showing the answer
// client-side is the point, no test cases are hidden and nothing is written to the database.
const CHECK =
  /<p>\s*check:\s*([\s\S]*?)<\/p>\s*<(ul|ol)\b[^>]*>([\s\S]*?)<\/\2>(?:\s*<p>\s*because:\s*([\s\S]*?)<\/p>)?/gi;
const LI = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
const TICK = /[✓✔]/; // check mark that marks the correct option

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

/**
 * Splits a note's (sanitized) HTML into an ordered list of segments: plain HTML to render as prose,
 * and inline "check" questions to render as interactive widgets. Pure string work, so it runs in SSR,
 * the browser, and node tests. A note with no checks returns as a single html segment.
 */
export function parseNoteSegments(html: string): Segment[] {
  const segs: Segment[] = [];
  let last = 0;

  for (const m of html.matchAll(CHECK)) {
    const start = m.index ?? 0;
    const pre = html.slice(last, start).trim();
    if (pre) segs.push({ kind: "html", html: pre });

    const question = stripTags(m[1]);
    const options: CheckOption[] = [];
    for (const li of m[3].matchAll(LI)) {
      const correct = TICK.test(li[1]);
      const text = stripTags(li[1].replace(TICK, ""));
      if (text) options.push({ text, correct });
    }
    const explanation = m[4] ? stripTags(m[4]) : null;

    if (question && options.length >= 2 && options.some((o) => o.correct)) {
      segs.push({ kind: "check", question, options, explanation });
    } else {
      // Looked like a check but was malformed; keep the original HTML so nothing is lost.
      segs.push({ kind: "html", html: m[0] });
    }
    last = start + m[0].length;
  }

  const rest = html.slice(last).trim();
  if (rest) segs.push({ kind: "html", html: rest });
  return segs.length ? segs : [{ kind: "html", html }];
}

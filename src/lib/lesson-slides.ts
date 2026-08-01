export type Slide = { heading: string | null; html: string };

const HR = /<hr\b[^>]*>/gi;
const LEADING_HEADING = /^<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/i;
// A sentinel that cannot occur in sanitized HTML, used to mark slide boundaries before splitting.
const MARK = "@@KAT_SLIDE_BREAK@@";

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

/**
 * Splits a lesson note's (already-sanitized) HTML into slides, so a wall of text reads one idea at a
 * time instead of like a textbook page. A new slide starts at each top-level <h1>/<h2>, or at a <hr>
 * (authors can type `---`, which the editor renders as <hr>); everything up to the next boundary is
 * that slide's body. Sub-headings (<h3>+) stay inside a slide, and lists stay intact.
 *
 * Pure string work (no DOM), so it runs identically in SSR, the browser, and node tests. Editor
 * output is flat at the top level, which is what makes the boundary split safe. A note with no
 * boundaries returns as a single slide, so a plain note still gets the slide treatment without paging.
 */
export function splitIntoSlides(input: string): Slide[] {
  const trimmed = input.trim();
  if (!trimmed) return [{ heading: null, html: input }];

  const marked = trimmed.replace(HR, MARK).replace(/(?=<h[12]\b)/gi, MARK);

  const slides: Slide[] = [];
  for (const chunk of marked.split(MARK)) {
    const html = chunk.trim();
    if (!html) continue;
    const m = html.match(LEADING_HEADING);
    const heading = m ? stripTags(m[1]).trim() || null : null;
    const body = m ? html.slice(m[0].length).trim() : html;
    slides.push({ heading, html: body });
  }

  return slides.length ? slides : [{ heading: null, html: trimmed }];
}

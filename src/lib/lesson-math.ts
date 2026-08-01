import katex from "katex";

// Turns TeX an author typed in a note into KaTeX markup, as a pure string transform so it runs at
// render time (SSR + client) rather than as a post-mount DOM mutation. Doing it in React's render
// output means a re-render can never wipe it, the way an external renderMathInElement() call would.
//
// Input is ALREADY sanitized HTML, so "<" / ">" / "&" inside a formula arrive entity-encoded; we
// decode them only for the slice handed to KaTeX. KaTeX output is trusted (generated from the TeX
// with trust:false) and is injected without re-sanitizing.

type Delimiter = { left: string; right: string; display: boolean };

// $$ and \[ \] typeset as centered display math; $ and \( \) inline. Longer openers first so "$$"
// wins over "$".
const DELIMITERS: Delimiter[] = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "$", right: "$", display: false },
];

const ENTITIES: Record<string, string> = {
  "&lt;": "<", "&gt;": ">", "&amp;": "&", "&quot;": '"', "&#39;": "'", "&nbsp;": " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:lt|gt|amp|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

function renderOne(rawLatex: string, display: boolean): string {
  try {
    return katex.renderToString(decodeEntities(rawLatex), { displayMode: display, throwOnError: false });
  } catch {
    // Should be rare (throwOnError:false renders most bad input in red). Fall back to the original,
    // still-escaped delimited text so nothing is lost and no HTML breaks.
    const d = display ? "$$" : "$";
    return d + rawLatex + d;
  }
}

// Scan a run of text (never inside a tag) for delimiter pairs. Non-math text passes through
// unchanged, so its existing entity-escaping is preserved (no double-encoding).
function renderTextChunk(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const d = DELIMITERS.find((del) => text.startsWith(del.left, i));
    if (d) {
      const end = text.indexOf(d.right, i + d.left.length);
      if (end !== -1) {
        out += renderOne(text.slice(i + d.left.length, end), d.display);
        i = end + d.right.length;
        continue;
      }
    }
    out += text[i];
    i += 1;
  }
  return out;
}

/**
 * Replace TeX in a note's sanitized HTML with rendered KaTeX. Only text between tags is scanned, so a
 * "$" in a tag or attribute (an href, say) is never treated as a math delimiter.
 */
export function renderMathToHtml(html: string): string {
  return html
    .split(/(<[^>]+>)/)
    .map((token) => (token.startsWith("<") ? token : renderTextChunk(token)))
    .join("");
}

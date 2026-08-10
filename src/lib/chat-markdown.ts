/**
 * Minimal, safe Markdown -> HTML for the "Ask Kemi" enrollment chat.
 *
 * Gemini answers in Markdown (bold, lists, links), but the chat used to print it verbatim, so `**`
 * and `[](...)` showed up as literal characters. This renders ONLY the small subset Kemi emits:
 * headings, bold, italic, inline code, links (explicit AND bare URLs), and ordered/unordered lists.
 *
 * Safety, in layers:
 *  1. Every character of the model output is HTML-escaped FIRST, so raw `<script>`/tags can never
 *     survive as markup, only as visible text.
 *  2. Link hrefs are restricted to http(s)/mailto; anything else renders as plain text, not a link.
 *  3. The caller still runs the result through DOMPurify as a belt-and-suspenders second pass.
 *
 * This is deliberately NOT a general Markdown engine (no tables, blockquotes, images, nested lists).
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function anchor(url: string, label: string): string {
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

// Inline spans, run on ALREADY-ESCAPED text. Code spans and explicit `[label](url)` links are stashed
// as placeholders FIRST so that (a) markers inside them are not re-processed and (b) bare-URL
// autolinking below cannot touch a URL that is already a link or inside code. Placeholders are
// delimited by NUL, which escaped text never contains and no later rule matches. Restored last.
function renderInline(text: string): string {
  const stash: string[] = [];
  const keep = (html: string): string => `\x00${stash.push(html) - 1}\x00`;

  let out = text;

  out = out.replace(/`([^`]+)`/g, (_m, code: string) => keep(`<code>${code}</code>`));

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    // url is escaped text; & is already &amp;. Only allow http(s)/mailto, else drop the link.
    const safe = /^(https?:\/\/|mailto:)/i.test(url);
    return safe ? keep(anchor(url, label)) : label;
  });

  // Bare URLs Kemi writes without link syntax (e.g. a WhatsApp wa.me link). Explicit links and code
  // are already stashed, so nothing here is inside an existing anchor. Trailing sentence punctuation
  // is left outside the link so "visit https://x.com." does not swallow the period.
  out = out.replace(/\bhttps?:\/\/[^\s<]+/gi, (match: string) => {
    const trailing = /[).,!?;:]+$/.exec(match);
    const url = trailing ? match.slice(0, -trailing[0].length) : match;
    const tail = trailing ? trailing[0] : "";
    return keep(anchor(url, url)) + tail;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, b: string) => `<strong>${b}</strong>`);
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_m, pre: string, i: string) => `${pre}<em>${i}</em>`);
  out = out.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, (_m, pre: string, i: string) => `${pre}<em>${i}</em>`);

  // Restore stashed code/links last, so their contents were never touched by the rules above.
  // NUL is the placeholder delimiter precisely because escaped model text can never contain it.
  // eslint-disable-next-line no-control-regex
  return out.replace(/\x00(\d+)\x00/g, (_m, i: string) => stash[Number(i)]);
}

const ORDERED = /^\s*\d+\.\s+/;
const UNORDERED = /^\s*[-*]\s+/;
const HEADING = /^\s*#{1,6}\s+/;

export function markdownToHtml(md: string): string {
  const lines = escapeHtml(md).split(/\r?\n/);
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    if (HEADING.test(line)) {
      blocks.push(`<p><strong>${renderInline(line.replace(HEADING, ""))}</strong></p>`);
      i++;
      continue;
    }

    if (ORDERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(ORDERED, ""))}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (UNORDERED.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UNORDERED.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(UNORDERED, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Paragraph: gather consecutive plain lines, single newlines become <br>.
    const para: string[] = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
      !UNORDERED.test(lines[i]) &&
      !HEADING.test(lines[i])
    ) {
      para.push(renderInline(lines[i]));
      i++;
    }
    blocks.push(`<p>${para.join("<br>")}</p>`);
  }

  return blocks.join("");
}

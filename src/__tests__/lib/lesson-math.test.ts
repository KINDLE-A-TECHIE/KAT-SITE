import { describe, it, expect } from "vitest";
import { renderMathToHtml } from "@/lib/lesson-math";

describe("renderMathToHtml", () => {
  it("renders inline $...$ as KaTeX", () => {
    const out = renderMathToHtml("<p>Area is $a^2$ here.</p>");
    expect(out).toContain("katex");
    expect(out).not.toContain("$a^2$");
    expect(out).toContain("<p>"); // surrounding html preserved
  });

  it("renders display $$...$$ as display-mode KaTeX", () => {
    const out = renderMathToHtml("<p>$$x = y$$</p>");
    expect(out).toContain("katex-display");
  });

  it("supports \\(...\\) and \\[...\\] delimiters", () => {
    expect(renderMathToHtml("<p>\\( a + b \\)</p>")).toContain("katex");
    expect(renderMathToHtml("<p>\\[ a + b \\]</p>")).toContain("katex-display");
  });

  it("decodes entities inside a formula so x < y typesets", () => {
    const out = renderMathToHtml("<p>$x &lt; y$</p>");
    expect(out).toContain("katex");
    expect(out).not.toContain("$x"); // the "$" delimiters were consumed
    expect(out).toContain("<mo>&lt;</mo>"); // "<" reached KaTeX as a relation, not left as text
  });

  it("leaves an unpaired $ untouched (currency, not math)", () => {
    const input = "<p>It costs $5 to enter.</p>";
    expect(renderMathToHtml(input)).toBe(input);
  });

  it("never treats a $ inside a tag or attribute as a delimiter", () => {
    const input = '<a href="/pay?amt=$5$">link</a>';
    expect(renderMathToHtml(input)).toBe(input);
  });

  it("passes plain html through unchanged", () => {
    const input = "<p>No math here at all.</p>";
    expect(renderMathToHtml(input)).toBe(input);
  });
});

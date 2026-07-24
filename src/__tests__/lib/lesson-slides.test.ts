import { describe, it, expect } from "vitest";
import { splitIntoSlides } from "@/lib/lesson-slides";

describe("splitIntoSlides", () => {
  it("returns a single slide for a note with no headings", () => {
    const s = splitIntoSlides("<p>Hello</p><p>World</p>");
    expect(s).toHaveLength(1);
    expect(s[0].heading).toBeNull();
    expect(s[0].html).toBe("<p>Hello</p><p>World</p>");
  });

  it("starts a new slide at each h1/h2 and captures the heading text", () => {
    const s = splitIntoSlides("<h2>One</h2><p>a</p><h2>Two</h2><p>b</p><p>c</p>");
    expect(s).toHaveLength(2);
    expect(s[0].heading).toBe("One");
    expect(s[0].html).toBe("<p>a</p>");
    expect(s[1].heading).toBe("Two");
    expect(s[1].html).toBe("<p>b</p><p>c</p>");
  });

  it("breaks on <hr> (the `---` an editor produces)", () => {
    const s = splitIntoSlides("<p>a</p><hr><p>b</p>");
    expect(s).toHaveLength(2);
    expect(s[0].html).toBe("<p>a</p>");
    expect(s[1].html).toBe("<p>b</p>");
  });

  it("keeps h3+ as slide content, not a slide break", () => {
    const s = splitIntoSlides("<h2>T</h2><h3>sub</h3><p>a</p>");
    expect(s).toHaveLength(1);
    expect(s[0].heading).toBe("T");
    expect(s[0].html).toBe("<h3>sub</h3><p>a</p>");
  });

  it("puts content before the first heading on its own leading slide", () => {
    const s = splitIntoSlides("<p>intro</p><h2>Sec</h2><p>body</p>");
    expect(s).toHaveLength(2);
    expect(s[0].heading).toBeNull();
    expect(s[0].html).toBe("<p>intro</p>");
    expect(s[1].heading).toBe("Sec");
  });

  it("strips inline tags from the heading text", () => {
    const s = splitIntoSlides('<h1>The <strong>Big</strong> Idea</h1><p>x</p>');
    expect(s[0].heading).toBe("The Big Idea");
  });

  it("keeps lists intact within a slide", () => {
    const s = splitIntoSlides("<h2>Points</h2><ul><li>one</li><li>two</li></ul>");
    expect(s).toHaveLength(1);
    expect(s[0].html).toContain("<li>one</li>");
    expect(s[0].html).toContain("<li>two</li>");
  });

  it("falls back to one slide for empty input", () => {
    expect(splitIntoSlides("")).toHaveLength(1);
    expect(splitIntoSlides("   ")).toHaveLength(1);
  });
});

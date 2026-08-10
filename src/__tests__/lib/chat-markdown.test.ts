import { describe, expect, it } from "vitest";
import { markdownToHtml } from "@/lib/chat-markdown";

describe("markdownToHtml (Kemi chat)", () => {
  it("renders bold, italic, and inline code", () => {
    expect(markdownToHtml("**bold**")).toBe("<p><strong>bold</strong></p>");
    expect(markdownToHtml("say *hi* now")).toBe("<p>say <em>hi</em> now</p>");
    expect(markdownToHtml("use `npm run dev`")).toBe("<p>use <code>npm run dev</code></p>");
  });

  it("renders an ordered list", () => {
    expect(markdownToHtml("1. First\n2. Second")).toBe(
      "<ol><li>First</li><li>Second</li></ol>",
    );
  });

  it("renders an unordered list without treating bullets as bold", () => {
    expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders http/mailto links and keeps them clickable", () => {
    expect(markdownToHtml("[register](http://localhost:3000/register)")).toBe(
      '<p><a href="http://localhost:3000/register" target="_blank" rel="noopener noreferrer">register</a></p>',
    );
  });

  it("drops unsafe link protocols, keeping only the text", () => {
    // javascript: URL must NOT become an anchor. It falls back to the label text (a stray ")" from
    // the unbalanced parens is harmless), the point is no <a> and no javascript: survive.
    const out = markdownToHtml("[click](javascript:alert(1))");
    expect(out).toContain("click");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<a");
  });

  it("escapes raw HTML so it can never become markup", () => {
    const out = markdownToHtml("<script>alert(1)</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("treats a Markdown heading as a bold line", () => {
    expect(markdownToHtml("## Class Format")).toBe("<p><strong>Class Format</strong></p>");
  });

  it("splits blank-line-separated text into paragraphs and keeps single newlines as breaks", () => {
    expect(markdownToHtml("line one\nline two\n\nnext para")).toBe(
      "<p>line one<br>line two</p><p>next para</p>",
    );
  });

  it("auto-links a bare URL that has no Markdown link syntax", () => {
    expect(markdownToHtml("chat on https://wa.me/234 now")).toBe(
      '<p>chat on <a href="https://wa.me/234" target="_blank" rel="noopener noreferrer">https://wa.me/234</a> now</p>',
    );
  });

  it("keeps trailing sentence punctuation outside an auto-linked URL", () => {
    const out = markdownToHtml("see https://x.com.");
    expect(out).toContain('<a href="https://x.com" target="_blank" rel="noopener noreferrer">https://x.com</a>');
    expect(out).toContain("</a>.</p>"); // the period stays as text, outside the link
  });

  it("does not double-link a URL already inside a Markdown link", () => {
    const out = markdownToHtml("[our site](https://x.com)");
    expect(out).toBe(
      '<p><a href="https://x.com" target="_blank" rel="noopener noreferrer">our site</a></p>',
    );
    expect(out.match(/<a /g)?.length).toBe(1); // exactly one anchor, not one wrapping another
  });

  it("does not auto-link a URL inside inline code", () => {
    const out = markdownToHtml("run `curl https://x.com`");
    expect(out).toContain("<code>curl https://x.com</code>");
    expect(out).not.toContain("<a ");
  });
});

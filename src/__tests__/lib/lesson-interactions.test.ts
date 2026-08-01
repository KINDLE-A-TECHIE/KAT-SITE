import { describe, it, expect } from "vitest";
import { parseNoteSegments } from "@/lib/lesson-interactions";

describe("parseNoteSegments", () => {
  it("returns one html segment when there is no check", () => {
    const s = parseNoteSegments("<p>Just a note</p>");
    expect(s).toEqual([{ kind: "html", html: "<p>Just a note</p>" }]);
  });

  it("extracts a check with the ticked option marked correct", () => {
    const html =
      "<p>Before</p><p>Check: Is a webcam input or output?</p><ul><li>Input ✓</li><li>Output</li></ul><p>After</p>";
    const s = parseNoteSegments(html);
    expect(s.map((x) => x.kind)).toEqual(["html", "check", "html"]);
    const check = s[1] as Extract<(typeof s)[number], { kind: "check" }>;
    expect(check.question).toBe("Is a webcam input or output?");
    expect(check.options).toEqual([
      { text: "Input", correct: true },
      { text: "Output", correct: false },
    ]);
    expect(check.explanation).toBeNull();
  });

  it("captures a Because: explanation", () => {
    const html =
      "<p>Check: 2 + 2?</p><ul><li>3</li><li>4 ✓</li></ul><p>Because: two twos make four.</p>";
    const check = parseNoteSegments(html)[0] as Extract<
      ReturnType<typeof parseNoteSegments>[number],
      { kind: "check" }
    >;
    expect(check.explanation).toBe("two twos make four.");
    expect(check.options[1]).toEqual({ text: "4", correct: true });
  });

  it("supports multiple correct options", () => {
    const html = "<p>Check: Which are input devices?</p><ul><li>Mouse ✓</li><li>Printer</li><li>Keyboard ✓</li></ul>";
    const check = parseNoteSegments(html)[0] as Extract<
      ReturnType<typeof parseNoteSegments>[number],
      { kind: "check" }
    >;
    expect(check.options.filter((o) => o.correct).map((o) => o.text)).toEqual(["Mouse", "Keyboard"]);
  });

  it("is case-insensitive on the Check:/Because: keywords", () => {
    const html = "<p>CHECK: pick one</p><ul><li>a ✓</li><li>b</li></ul>";
    expect(parseNoteSegments(html)[0].kind).toBe("check");
  });

  it("keeps a malformed check (no ticked option) as plain html", () => {
    const html = "<p>Check: no answer marked</p><ul><li>a</li><li>b</li></ul>";
    expect(parseNoteSegments(html).every((x) => x.kind === "html")).toBe(true);
  });

  it("handles two checks in one note", () => {
    const html =
      "<p>Check: q1</p><ul><li>a ✓</li><li>b</li></ul><p>middle</p><p>Check: q2</p><ul><li>c</li><li>d ✓</li></ul>";
    const kinds = parseNoteSegments(html).map((x) => x.kind);
    expect(kinds).toEqual(["check", "html", "check"]);
  });
});

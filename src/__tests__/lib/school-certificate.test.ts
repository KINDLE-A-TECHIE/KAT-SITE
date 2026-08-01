import { describe, it, expect } from "vitest";
import { pickHighlightTitles } from "@/lib/school-certificate";

const L = (id: string, title: string, certHighlight = false) => ({ id, title, certHighlight });

describe("pickHighlightTitles", () => {
  const lessons = [
    L("a", "Intro to Scratch", false),
    L("b", "Build a Maze Game", true),
    L("c", "Loops", false),
    L("d", "Make a Chatbot", true),
    L("e", "A Weather App", true),
    L("f", "Wrap up", true),
  ];

  it("prefers flagged highlight lessons the pupil completed, in order, capped at 3", () => {
    const completed = new Set(["a", "b", "c", "d", "e", "f"]);
    // b, d, e, f are flagged; capped at 3 -> b, d, e (learning order preserved).
    expect(pickHighlightTitles(lessons, completed)).toEqual([
      "Build a Maze Game",
      "Make a Chatbot",
      "A Weather App",
    ]);
  });

  it("only counts highlights the pupil actually completed", () => {
    const completed = new Set(["a", "d"]); // of the flagged ones, only d is done
    expect(pickHighlightTitles(lessons, completed)).toEqual(["Make a Chatbot"]);
  });

  it("falls back to the first completed lessons when none are flagged", () => {
    const plain = [L("a", "One"), L("b", "Two"), L("c", "Three"), L("d", "Four")];
    const completed = new Set(["a", "b", "c", "d"]);
    expect(pickHighlightTitles(plain, completed)).toEqual(["One", "Two", "Three"]);
  });

  it("returns nothing when nothing is completed", () => {
    expect(pickHighlightTitles(lessons, new Set())).toEqual([]);
  });

  it("respects a custom max", () => {
    const completed = new Set(["b", "d", "e", "f"]);
    expect(pickHighlightTitles(lessons, completed, 2)).toEqual(["Build a Maze Game", "Make a Chatbot"]);
  });
});

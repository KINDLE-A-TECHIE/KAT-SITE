import { describe, it, expect } from "vitest";
import { isWorldId, wrapForWorld, WORLD_META, WORLD_IDS, parseGridConfig, DEFAULT_GRID } from "@/lib/blockly-worlds";

describe("isWorldId", () => {
  it("accepts known worlds and rejects everything else", () => {
    expect(isWorldId("turtle")).toBe(true);
    expect(isWorldId("grid")).toBe(true);
    expect(isWorldId("maze")).toBe(false);
    expect(isWorldId("")).toBe(false);
    expect(isWorldId(null)).toBe(false);
    expect(isWorldId(undefined)).toBe(false);
    expect(isWorldId(42)).toBe(false);
  });
});

describe("WORLD_META", () => {
  it("has one entry per world id, each with a label and description", () => {
    expect(WORLD_META.map((w) => w.id).sort()).toEqual([...WORLD_IDS].sort());
    for (const w of WORLD_META) {
      expect(w.label.length).toBeGreaterThan(0);
      expect(w.description.length).toBeGreaterThan(0);
    }
  });
});

describe("wrapForWorld", () => {
  const wrapped = wrapForWorld("turtle", "kat.forward(50)\nkat.right(90)");

  it("injects the turtle runtime before the pupil code", () => {
    expect(wrapped).toContain("class _KatTurtle");
    expect(wrapped.indexOf("class _KatTurtle")).toBeLessThan(wrapped.indexOf("kat.forward(50)"));
  });

  it("swallows the pupil's own stdout, then restores it and prints only the report", () => {
    // The pupil's prints must not reach the graded stdout; only the runtime report does.
    expect(wrapped).toContain("_sys.stdout = _io.StringIO()");
    expect(wrapped).toContain("_sys.stdout = _kat_real_stdout");
    expect(wrapped).toContain("print(kat._report())");
    // The swallow happens before the pupil code, the restore + report after it.
    expect(wrapped.indexOf("_sys.stdout = _io.StringIO()")).toBeLessThan(wrapped.indexOf("kat.forward(50)"));
    expect(wrapped.indexOf("kat.right(90)")).toBeLessThan(wrapped.indexOf("print(kat._report())"));
  });

  it("runs the pupil code at top level (never indented), so their strings/defs are untouched", () => {
    // Each pupil line appears exactly as written, at column 0.
    expect(wrapped).toContain("\nkat.forward(50)\n");
    expect(wrapped).toContain("\nkat.right(90)\n");
  });

  it("handles empty pupil code without producing a partial program", () => {
    const empty = wrapForWorld("turtle", "");
    expect(empty).toContain("class _KatTurtle");
    expect(empty.trimEnd().endsWith("print(kat._report())")).toBe(true);
  });

  it("wraps the grid world with its own runtime, still swallowing stdout and reporting", () => {
    const wrapped = wrapForWorld("grid", "kat.move()");
    expect(wrapped).toContain("class _KatActor");
    expect(wrapped).toContain("_sys.stdout = _io.StringIO()");
    expect(wrapped).toContain("print(kat._report())");
    expect(wrapped.indexOf("_sys.stdout = _io.StringIO()")).toBeLessThan(wrapped.indexOf("kat.move()"));
  });
});

describe("parseGridConfig", () => {
  it("returns null for missing or malformed config", () => {
    expect(parseGridConfig(null)).toBeNull();
    expect(parseGridConfig("")).toBeNull();
    expect(parseGridConfig("not json")).toBeNull();
    expect(parseGridConfig("42")).toBeNull();
  });

  it("parses a full maze and matches the runtime's shape", () => {
    const grid = parseGridConfig(JSON.stringify(DEFAULT_GRID));
    expect(grid).not.toBeNull();
    expect(grid?.cols).toBe(DEFAULT_GRID.cols);
    expect(grid?.goal).toEqual(DEFAULT_GRID.goal);
    expect(grid?.heading).toBe("E");
  });

  it("applies the runtime's defaults and drops malformed walls", () => {
    const grid = parseGridConfig(JSON.stringify({ walls: [[1, 1], "bad", [2]], heading: "X" }));
    expect(grid?.cols).toBe(5);
    expect(grid?.rows).toBe(5);
    expect(grid?.start).toEqual([0, 0]);
    expect(grid?.heading).toBe("E"); // an unknown heading falls back to E, as the runtime does
    expect(grid?.goal).toBeNull();
    expect(grid?.walls).toEqual([[1, 1]]);
  });
});

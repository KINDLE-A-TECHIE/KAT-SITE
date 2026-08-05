import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  analyzeProject,
  analyzeSb3,
  evaluateCheck,
  scoreScratchProject,
  describeCheck,
  type ScratchCheck,
  type ScratchCheckSpec,
} from "@/lib/scratch-analysis";

// A synthetic project.json exercising every summary field: a Stage with 2 backdrops + 1 sound, a "Cat"
// sprite with a full script (green flag, loop, if, say, variable, custom block, broadcast, sound) plus a
// compressed-primitive array that must be ignored, and a "Ball" sprite that only moves.
const project = {
  targets: [
    {
      isStage: true,
      name: "Stage",
      costumes: [{ name: "backdrop1" }, { name: "backdrop2" }],
      sounds: [{ name: "pop" }],
      variables: { g: ["score", 0] },
      blocks: {},
    },
    {
      isStage: false,
      name: "Cat",
      costumes: [{ name: "costume1" }],
      sounds: [{ name: "Meow" }],
      variables: {},
      blocks: {
        a: { opcode: "event_whenflagclicked", next: "b" },
        b: { opcode: "control_repeat", inputs: {} },
        c: { opcode: "control_if" },
        d: { opcode: "looks_say" },
        e: { opcode: "data_setvariableto" },
        f: { opcode: "procedures_definition" },
        g: { opcode: "event_broadcast" },
        h: { opcode: "sound_play" },
        prim: [4, "10"], // compressed primitive, must NOT be counted as a block
      },
    },
    {
      isStage: false,
      name: "Ball",
      costumes: [{ name: "ball" }],
      sounds: [],
      variables: {},
      blocks: { x: { opcode: "motion_movesteps" } },
    },
  ],
};

describe("analyzeProject", () => {
  const s = analyzeProject(project);

  it("counts sprites, backdrops and sounds correctly", () => {
    expect(s.spriteCount).toBe(2);
    expect(s.spriteNames).toEqual(["Cat", "Ball"]);
    expect(s.backdropCount).toBe(2);
    expect(s.backdropNames).toEqual(["backdrop1", "backdrop2"]);
    expect(s.soundCount).toBe(2); // pop (stage) + Meow (cat)
    expect(s.soundNames).toEqual(["pop", "Meow"]);
  });

  it("counts blocks and opcodes, ignoring compressed-primitive arrays", () => {
    expect(s.totalBlocks).toBe(9); // 8 in Cat (prim array excluded) + 1 in Ball
    expect(s.opcodes.control_repeat).toBe(1);
    expect(s.opcodes.motion_movesteps).toBe(1);
    expect(s.opcodes.prim).toBeUndefined();
  });

  it("derives the concept flags", () => {
    expect(s.hasLoop).toBe(true);
    expect(s.hasConditional).toBe(true);
    expect(s.hasEventHat).toBe(true);
    expect(s.hasGreenFlag).toBe(true);
    expect(s.usesBroadcast).toBe(true);
    expect(s.usesSound).toBe(true);
    expect(s.usesMotion).toBe(true);
    expect(s.usesLooks).toBe(true);
    expect(s.usesVariable).toBe(true);
    expect(s.customBlockCount).toBe(1);
    expect(s.variableCount).toBe(1);
  });

  it("does not crash on a malformed project", () => {
    expect(analyzeProject(null).spriteCount).toBe(0);
    expect(analyzeProject({ targets: "nope" }).totalBlocks).toBe(0);
    expect(analyzeProject({ targets: [{ isStage: false }] }).spriteNames).toEqual([""]);
  });
});

describe("evaluateCheck", () => {
  const s = analyzeProject(project);
  const chk = (c: ScratchCheckSpec): ScratchCheck => ({ id: "x", label: "", points: 1, ...c });

  it("count checks compare against the threshold", () => {
    expect(evaluateCheck(s, chk({ kind: "count", metric: "sprites", min: 2 }))).toBe(true);
    expect(evaluateCheck(s, chk({ kind: "count", metric: "sprites", min: 3 }))).toBe(false);
    expect(evaluateCheck(s, chk({ kind: "count", metric: "backdrops", min: 2 }))).toBe(true);
    expect(evaluateCheck(s, chk({ kind: "count", metric: "blocks", min: 20 }))).toBe(false);
  });

  it("concept checks read the flags", () => {
    expect(evaluateCheck(s, chk({ kind: "concept", concept: "loop" }))).toBe(true);
    expect(evaluateCheck(s, chk({ kind: "concept", concept: "broadcast" }))).toBe(true);
  });

  it("spriteNamed is case- and space-insensitive", () => {
    expect(evaluateCheck(s, chk({ kind: "spriteNamed", name: "  cat " }))).toBe(true);
    expect(evaluateCheck(s, chk({ kind: "spriteNamed", name: "Dog" }))).toBe(false);
  });

  it("opcode checks look for a specific block", () => {
    expect(evaluateCheck(s, chk({ kind: "opcode", opcode: "sound_play" }))).toBe(true);
    expect(evaluateCheck(s, chk({ kind: "opcode", opcode: "pen_penDown" }))).toBe(false);
  });
});

describe("scoreScratchProject", () => {
  it("sums points for passed checks and totals all", () => {
    const s = analyzeProject(project);
    const checks: ScratchCheck[] = [
      { id: "1", label: "2 sprites", kind: "count", metric: "sprites", min: 2, points: 2 }, // pass
      { id: "2", label: "3 backdrops", kind: "count", metric: "backdrops", min: 3, points: 1 }, // fail
      { id: "3", label: "loop", kind: "concept", concept: "loop", points: 2 }, // pass
      { id: "4", label: "named cat", kind: "spriteNamed", name: "cat", points: 1 }, // pass
      { id: "5", label: "pen", kind: "opcode", opcode: "pen_penDown", points: 1 }, // fail
    ];
    const r = scoreScratchProject(s, checks);
    expect(r.total).toBe(7);
    expect(r.earned).toBe(5); // 2 + 2 + 1
    expect(r.passedCount).toBe(3);
    expect(r.results.map((x) => x.passed)).toEqual([true, false, true, true, false]);
  });

  it("falls back to describeCheck when no label is given", () => {
    const s = analyzeProject(project);
    const r = scoreScratchProject(s, [{ id: "1", label: "", kind: "concept", concept: "loop", points: 1 }]);
    expect(r.results[0].label).toBe("Uses a loop");
  });
});

describe("describeCheck", () => {
  it("produces readable defaults", () => {
    expect(describeCheck({ id: "1", label: "", points: 1, kind: "count", metric: "sprites", min: 2 })).toBe("At least 2 sprites");
    expect(describeCheck({ id: "1", label: "", points: 1, kind: "spriteNamed", name: "Cat" })).toBe('Has a sprite named "Cat"');
  });
});

describe("analyzeSb3 (real zip round-trip)", () => {
  it("unzips a .sb3 and analyzes its project.json", () => {
    const sb3 = zipSync({ "project.json": strToU8(JSON.stringify(project)) });
    const s = analyzeSb3(sb3);
    expect(s.spriteCount).toBe(2);
    expect(s.backdropCount).toBe(2);
    expect(s.soundCount).toBe(2);
    expect(s.hasLoop).toBe(true);
  });

  it("rejects non-zip bytes and empty input with a clear error", () => {
    expect(() => analyzeSb3(new Uint8Array([1, 2, 3, 4]))).toThrow(/not a valid Scratch project/i);
    expect(() => analyzeSb3(new Uint8Array())).toThrow(/empty/i);
  });

  it("rejects a zip that has no project.json", () => {
    const notScratch = zipSync({ "hello.txt": strToU8("hi") });
    expect(() => analyzeSb3(notScratch)).toThrow(/no project\.json/i);
  });
});

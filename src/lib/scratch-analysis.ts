/**
 * Static grading for a Scratch project. A .sb3 is a zip whose `project.json` fully describes the project,
 * so grading is READING that file, not running anything. This module:
 *   1. analyzes a project into a structural summary (sprites, backdrops, sounds, blocks, concepts used),
 *   2. scores that summary against a checklist of requirements a teacher authored.
 *
 * It grades what the project CONTAINS and USES, which is objective and stable. It does NOT judge whether
 * the project BEHAVES correctly (that needs running the VM headlessly, which for Scratch is flaky) or
 * whether it is creative (that stays a human rubric). Pure + dependency-light (fflate only), so it runs on
 * the server (the submission grader) or the client, and is fully unit-testable.
 */

import { unzipSync, strFromU8 } from "fflate";

// ── Summary ─────────────────────────────────────────────────────────────────────

export type ScratchSummary = {
  spriteCount: number; // non-stage targets
  spriteNames: string[];
  backdropCount: number; // the Stage's costumes are the backdrops
  backdropNames: string[];
  soundCount: number; // total sounds across every target
  soundNames: string[];
  totalBlocks: number; // real blocks (compressed input primitives excluded)
  opcodes: Record<string, number>; // opcode -> how many times it appears
  variableCount: number;
  customBlockCount: number; // procedures_definition
  hasLoop: boolean;
  hasConditional: boolean;
  hasEventHat: boolean;
  hasGreenFlag: boolean;
  usesBroadcast: boolean;
  usesVariable: boolean;
  usesSound: boolean;
  usesMotion: boolean;
  usesLooks: boolean;
};

const LOOP_OPCODES = new Set(["control_repeat", "control_forever", "control_repeat_until", "control_while", "control_for_each"]);
const CONDITIONAL_OPCODES = new Set(["control_if", "control_if_else"]);
const BROADCAST_OPCODES = new Set(["event_broadcast", "event_broadcastandwait", "event_whenbroadcastreceived"]);

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Analyze a parsed `project.json` object into a structural summary. Tolerant of a malformed shape. */
export function analyzeProject(project: unknown): ScratchSummary {
  const targets = asArray(asRecord(project).targets);
  const spriteNames: string[] = [];
  const backdropNames: string[] = [];
  const soundNames: string[] = [];
  const opcodes: Record<string, number> = {};
  let backdropCount = 0;
  let soundCount = 0;
  let totalBlocks = 0;
  let variableCount = 0;

  for (const raw of targets) {
    const t = asRecord(raw);
    const isStage = Boolean(t.isStage);
    const costumes = asArray(t.costumes);
    const sounds = asArray(t.sounds);

    if (isStage) {
      backdropCount += costumes.length;
      for (const c of costumes) backdropNames.push(asString(asRecord(c).name));
    } else {
      spriteNames.push(asString(t.name));
    }
    soundCount += sounds.length;
    for (const s of sounds) soundNames.push(asString(asRecord(s).name));
    variableCount += Object.keys(asRecord(t.variables)).length;

    const blocks = asRecord(t.blocks);
    for (const id of Object.keys(blocks)) {
      const b = blocks[id];
      // A block is an object with a string opcode. Values that are ARRAYS are compressed input
      // primitives (e.g. [4, "10"] for a number), not blocks, so they must not be counted.
      if (!b || typeof b !== "object" || Array.isArray(b)) continue;
      const op = asString((b as Record<string, unknown>).opcode);
      if (!op) continue;
      totalBlocks += 1;
      opcodes[op] = (opcodes[op] || 0) + 1;
    }
  }

  const anyOpcode = (pred: (op: string) => boolean) => Object.keys(opcodes).some(pred);

  return {
    spriteCount: spriteNames.length,
    spriteNames,
    backdropCount,
    backdropNames,
    soundCount,
    soundNames,
    totalBlocks,
    opcodes,
    variableCount,
    customBlockCount: opcodes.procedures_definition || 0,
    hasLoop: anyOpcode((op) => LOOP_OPCODES.has(op)),
    hasConditional: anyOpcode((op) => CONDITIONAL_OPCODES.has(op)),
    hasEventHat: anyOpcode((op) => op.startsWith("event_when")),
    hasGreenFlag: Boolean(opcodes.event_whenflagclicked),
    usesBroadcast: anyOpcode((op) => BROADCAST_OPCODES.has(op)),
    usesVariable: variableCount > 0 || anyOpcode((op) => op.startsWith("data_")),
    usesSound: anyOpcode((op) => op.startsWith("sound_")),
    usesMotion: anyOpcode((op) => op.startsWith("motion_")),
    usesLooks: anyOpcode((op) => op.startsWith("looks_")),
  };
}

const MAX_SB3_BYTES = 25 * 1024 * 1024;

/**
 * Unzip a .sb3, read ONLY its project.json (a filter avoids decompressing the assets), and analyze it.
 * Throws a friendly Error for anything that is not a readable .sb3, so a grader can score it 0 with a
 * clear reason rather than crashing.
 */
export function analyzeSb3(bytes: Uint8Array): ScratchSummary {
  if (!bytes || bytes.byteLength === 0) throw new Error("The project file is empty.");
  if (bytes.byteLength > MAX_SB3_BYTES) throw new Error("The project file is too large to grade.");
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === "project.json" });
  } catch {
    throw new Error("That file is not a valid Scratch project (.sb3).");
  }
  const pj = files["project.json"];
  if (!pj) throw new Error("This .sb3 has no project.json.");
  let project: unknown;
  try {
    project = JSON.parse(strFromU8(pj));
  } catch {
    throw new Error("The project data is corrupted.");
  }
  return analyzeProject(project);
}

// ── Checks ──────────────────────────────────────────────────────────────────────

export type CountMetric = "sprites" | "backdrops" | "sounds" | "blocks" | "variables" | "customBlocks";
export type Concept =
  | "loop"
  | "conditional"
  | "greenFlag"
  | "broadcast"
  | "usesVariable"
  | "usesSound"
  | "usesMotion"
  | "usesLooks";

/** The rule part of a check (what to test), without the author-supplied id/label/points. */
export type ScratchCheckSpec =
  | { kind: "count"; metric: CountMetric; min: number }
  | { kind: "concept"; concept: Concept }
  | { kind: "spriteNamed"; name: string }
  | { kind: "opcode"; opcode: string };

/** One requirement a project is graded against. `label` is shown to the author and to the pupil. */
export type ScratchCheck = { id: string; label: string; points: number } & ScratchCheckSpec;

const COUNT_OF: Record<CountMetric, (s: ScratchSummary) => number> = {
  sprites: (s) => s.spriteCount,
  backdrops: (s) => s.backdropCount,
  sounds: (s) => s.soundCount,
  blocks: (s) => s.totalBlocks,
  variables: (s) => s.variableCount,
  customBlocks: (s) => s.customBlockCount,
};
const CONCEPT_OF: Record<Concept, (s: ScratchSummary) => boolean> = {
  loop: (s) => s.hasLoop,
  conditional: (s) => s.hasConditional,
  greenFlag: (s) => s.hasGreenFlag,
  broadcast: (s) => s.usesBroadcast,
  usesVariable: (s) => s.usesVariable,
  usesSound: (s) => s.usesSound,
  usesMotion: (s) => s.usesMotion,
  usesLooks: (s) => s.usesLooks,
};

const COUNT_LABEL: Record<CountMetric, string> = {
  sprites: "sprites",
  backdrops: "backdrops",
  sounds: "sounds",
  blocks: "blocks",
  variables: "variables",
  customBlocks: "custom blocks",
};
const CONCEPT_LABEL: Record<Concept, string> = {
  loop: "Uses a loop",
  conditional: "Uses an if",
  greenFlag: "Has a green-flag script",
  broadcast: "Uses broadcast",
  usesVariable: "Uses a variable",
  usesSound: "Uses a sound block",
  usesMotion: "Uses a motion block",
  usesLooks: "Uses a looks block",
};

/** Does the project satisfy this one check? Pure. */
export function evaluateCheck(summary: ScratchSummary, check: ScratchCheck): boolean {
  switch (check.kind) {
    case "count":
      return COUNT_OF[check.metric](summary) >= check.min;
    case "concept":
      return CONCEPT_OF[check.concept](summary);
    case "spriteNamed":
      return summary.spriteNames.some((n) => n.trim().toLowerCase() === check.name.trim().toLowerCase());
    case "opcode":
      return (summary.opcodes[check.opcode] || 0) > 0;
    default:
      return false;
  }
}

/** A sensible default label for a check, when the author has not written their own. */
export function describeCheck(check: ScratchCheck): string {
  switch (check.kind) {
    case "count":
      return `At least ${check.min} ${COUNT_LABEL[check.metric]}`;
    case "concept":
      return CONCEPT_LABEL[check.concept];
    case "spriteNamed":
      return `Has a sprite named "${check.name}"`;
    case "opcode":
      return `Uses the ${check.opcode} block`;
    default:
      return "Requirement";
  }
}

export type ScratchCheckResult = { id: string; label: string; passed: boolean; points: number; earned: number };

/**
 * Score a project summary against a checklist. Mirrors `scoreCodeAnswer` in practical-grading.ts: `total`
 * is the sum of every check's points, `earned` the sum of the passed ones.
 */
export function scoreScratchProject(
  summary: ScratchSummary,
  checks: ScratchCheck[],
): { results: ScratchCheckResult[]; earned: number; total: number; passedCount: number } {
  let earned = 0;
  let total = 0;
  let passedCount = 0;
  const results = checks.map((check) => {
    const points = Math.max(0, check.points);
    total += points;
    const passed = evaluateCheck(summary, check);
    if (passed) {
      earned += points;
      passedCount += 1;
    }
    return { id: check.id, label: check.label || describeCheck(check), passed, points, earned: passed ? points : 0 };
  });
  return { results, earned, total, passedCount };
}

const COUNT_METRICS: CountMetric[] = ["sprites", "backdrops", "sounds", "blocks", "variables", "customBlocks"];
const CONCEPTS: Concept[] = ["loop", "conditional", "greenFlag", "broadcast", "usesVariable", "usesSound", "usesMotion", "usesLooks"];

function isValidCheck(v: unknown): v is ScratchCheck {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  if (typeof c.id !== "string" || typeof c.label !== "string" || typeof c.points !== "number") return false;
  switch (c.kind) {
    case "count":
      return COUNT_METRICS.includes(c.metric as CountMetric) && typeof c.min === "number";
    case "concept":
      return CONCEPTS.includes(c.concept as Concept);
    case "spriteNamed":
      return typeof c.name === "string" && c.name.length > 0;
    case "opcode":
      return typeof c.opcode === "string" && c.opcode.length > 0;
    default:
      return false;
  }
}

/** Parse the stored `scratchChecks` JSON string into a validated checklist, dropping malformed entries. */
export function parseScratchChecks(raw: string | null | undefined): ScratchCheck[] {
  if (!raw || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(isValidCheck) : [];
}

/** Ready-made check templates for the authoring picker (id/points filled in by the caller). */
export const SCRATCH_CHECK_TEMPLATES: Array<ScratchCheckSpec & { label: string }> = [
  { kind: "count", metric: "sprites", min: 2, label: "At least 2 sprites" },
  { kind: "count", metric: "backdrops", min: 2, label: "At least 2 backdrops" },
  { kind: "count", metric: "sounds", min: 1, label: "Uses at least 1 sound" },
  { kind: "count", metric: "blocks", min: 10, label: "At least 10 blocks" },
  { kind: "concept", concept: "greenFlag", label: "Has a green-flag script" },
  { kind: "concept", concept: "loop", label: "Uses a loop" },
  { kind: "concept", concept: "conditional", label: "Uses an if" },
  { kind: "concept", concept: "usesVariable", label: "Uses a variable" },
  { kind: "concept", concept: "broadcast", label: "Uses broadcast" },
  { kind: "concept", concept: "usesSound", label: "Uses a sound block" },
  { kind: "count", metric: "customBlocks", min: 1, label: "Defines a custom block" },
];

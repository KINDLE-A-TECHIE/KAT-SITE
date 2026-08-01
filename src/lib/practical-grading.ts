/**
 * Pure scoring primitives for practical (and theory) assessment. No I/O, no runtime: given the OUTCOME
 * of running a pupil's work, these compute the score. The runtime that actually runs the code (Pyodide
 * by default, Judge0 when configured) or the teacher who observes a build feeds these functions; keeping
 * the maths pure means every scoring rule is unit-testable and identical wherever it runs.
 *
 * Two practical shapes:
 *   - CODE: auto-graded. The pupil's program is run once per hidden test case and its output compared to
 *     the expected output. Each passed case earns its points.
 *   - RUBRIC: teacher-graded. The teacher awards up to `maxPoints` per criterion.
 *
 * Plus the term-result maths (weighted CA + Exam -> percentage -> grade) that Phase 1c builds on.
 */

// ── Output comparison (for CODE test cases) ─────────────────────────────────────

/**
 * Normalize program output before comparing, so a pupil is not failed by a trailing newline or a
 * carriage return. Unifies line endings, strips trailing whitespace on each line, and trims blank
 * lines at the very start and end. Interior blank lines are kept (they can be meaningful).
 */
export function normalizeOutput(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

export function matchOutput(
  actual: string,
  expected: string,
  opts: { caseSensitive?: boolean } = {},
): boolean {
  let a = normalizeOutput(actual);
  let e = normalizeOutput(expected);
  if (opts.caseSensitive === false) {
    a = a.toLowerCase();
    e = e.toLowerCase();
  }
  return a === e;
}

// ── CODE scoring ────────────────────────────────────────────────────────────────

export type CodeTestCase = { id?: string; expectedStdout: string; points: number };
export type CodeTestRun = { testCase: CodeTestCase; actualStdout: string; errored?: boolean };
export type CodeTestResult = { id?: string; passed: boolean; points: number; earned: number };

/**
 * Score a CODE answer from the actual output produced for each test case. A test case that errored (the
 * program threw or timed out) never passes. Returns per-case results plus totals; `total` is the sum of
 * all test-case points, `earned` the sum of the passed ones.
 */
export function scoreCodeAnswer(
  runs: CodeTestRun[],
  opts: { caseSensitive?: boolean } = {},
): { results: CodeTestResult[]; earned: number; total: number; passedCount: number } {
  let earned = 0;
  let total = 0;
  let passedCount = 0;

  const results = runs.map((run) => {
    const points = Math.max(0, run.testCase.points);
    total += points;
    const passed = !run.errored && matchOutput(run.actualStdout, run.testCase.expectedStdout, opts);
    if (passed) {
      earned += points;
      passedCount += 1;
    }
    return { id: run.testCase.id, passed, points, earned: passed ? points : 0 };
  });

  return { results, earned, total, passedCount };
}

// ── RUBRIC scoring ──────────────────────────────────────────────────────────────

export type RubricCriterion = { id: string; maxPoints: number };

/**
 * Score a RUBRIC answer. `awarded` maps criterionId -> points the teacher gave; each is clamped to
 * [0, maxPoints], unknown ids are ignored, and a missing criterion counts as 0. `total` is the sum of
 * every criterion's maxPoints.
 */
export function scoreRubric(
  criteria: RubricCriterion[],
  awarded: Record<string, number>,
): { earned: number; total: number } {
  let earned = 0;
  let total = 0;
  for (const criterion of criteria) {
    const max = Math.max(0, criterion.maxPoints);
    total += max;
    const raw = awarded[criterion.id];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      earned += Math.min(max, Math.max(0, raw));
    }
  }
  return { earned, total };
}

// ── Term result (weighted CA + Exam -> percentage -> grade) ─────────────────────

export type ScoreComponent = { earned: number; total: number; weight: number };

/**
 * Combine weighted components (e.g. continuous assessment and exam) into a single percentage. Each
 * component contributes its own percentage scaled by its weight; components with no marks available
 * (total 0) are dropped so they neither help nor hurt. Returns 0 when nothing is gradable yet.
 */
export function weightedPercent(components: ScoreComponent[]): number {
  let weightedSum = 0;
  let weightUsed = 0;
  for (const c of components) {
    if (c.total <= 0 || c.weight <= 0) continue;
    const pct = (c.earned / c.total) * 100;
    weightedSum += pct * c.weight;
    weightUsed += c.weight;
  }
  if (weightUsed === 0) return 0;
  return Math.round((weightedSum / weightUsed) * 10) / 10; // one decimal place
}

export type GradeBand = { min: number; grade: string };

/**
 * Default grade bands. Deliberately simple and school-configurable later; the pass mark is the lowest
 * non-F band (D at 40).
 */
export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { min: 70, grade: "A" },
  { min: 60, grade: "B" },
  { min: 50, grade: "C" },
  { min: 45, grade: "D" },
  { min: 40, grade: "E" },
  { min: 0, grade: "F" },
];

export const DEFAULT_PASS_MARK = 40;

/** Map a percentage to a grade using the given bands (highest matching `min` wins). */
export function gradeFor(percent: number, bands: GradeBand[] = DEFAULT_GRADE_BANDS): string {
  const ordered = [...bands].sort((a, b) => b.min - a.min);
  for (const band of ordered) {
    if (percent >= band.min) return band.grade;
  }
  return ordered.length > 0 ? ordered[ordered.length - 1].grade : "";
}

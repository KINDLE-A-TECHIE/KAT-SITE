import { describe, it, expect } from "vitest";
import {
  normalizeOutput,
  matchOutput,
  scoreCodeAnswer,
  scoreRubric,
  weightedPercent,
  gradeFor,
  DEFAULT_PASS_MARK,
  type CodeTestRun,
  type RubricCriterion,
} from "@/lib/practical-grading";

describe("normalizeOutput", () => {
  it("unifies CRLF and CR to LF", () => {
    expect(normalizeOutput("a\r\nb\rc")).toBe("a\nb\nc");
  });
  it("strips trailing whitespace per line and surrounding blank lines", () => {
    expect(normalizeOutput("\n\nhello   \nworld\t\n\n")).toBe("hello\nworld");
  });
  it("keeps interior blank lines", () => {
    expect(normalizeOutput("a\n\nb")).toBe("a\n\nb");
  });
});

describe("matchOutput", () => {
  it("passes when only trailing newline differs (the classic false-fail)", () => {
    expect(matchOutput("42\n", "42")).toBe(true);
  });
  it("is case-sensitive by default", () => {
    expect(matchOutput("Hello", "hello")).toBe(false);
  });
  it("can be made case-insensitive", () => {
    expect(matchOutput("Hello", "hello", { caseSensitive: false })).toBe(true);
  });
  it("fails on a genuine difference", () => {
    expect(matchOutput("41", "42")).toBe(false);
  });
});

describe("scoreCodeAnswer", () => {
  const cases: CodeTestRun[] = [
    { testCase: { id: "t1", expectedStdout: "3", points: 2 }, actualStdout: "3\n" },
    { testCase: { id: "t2", expectedStdout: "5", points: 2 }, actualStdout: "6" },
    { testCase: { id: "t3", expectedStdout: "9", points: 1 }, actualStdout: "9" },
  ];

  it("earns points only for passed cases, over the full total", () => {
    const r = scoreCodeAnswer(cases);
    expect(r.total).toBe(5);
    expect(r.earned).toBe(3); // t1 (2) + t3 (1); t2 wrong
    expect(r.passedCount).toBe(2);
    expect(r.results.map((x) => x.passed)).toEqual([true, false, true]);
  });

  it("never passes an errored run even if the output would match", () => {
    const r = scoreCodeAnswer([
      { testCase: { expectedStdout: "3", points: 2 }, actualStdout: "3", errored: true },
    ]);
    expect(r.earned).toBe(0);
    expect(r.passedCount).toBe(0);
  });

  it("handles an empty test set as zero over zero", () => {
    const r = scoreCodeAnswer([]);
    expect(r).toEqual({ results: [], earned: 0, total: 0, passedCount: 0 });
  });

  it("treats negative points as zero", () => {
    const r = scoreCodeAnswer([
      { testCase: { expectedStdout: "1", points: -5 }, actualStdout: "1" },
    ]);
    expect(r.total).toBe(0);
    expect(r.earned).toBe(0);
  });
});

describe("scoreRubric", () => {
  const criteria: RubricCriterion[] = [
    { id: "c1", maxPoints: 5 },
    { id: "c2", maxPoints: 3 },
    { id: "c3", maxPoints: 2 },
  ];

  it("sums awarded points against the full total", () => {
    const r = scoreRubric(criteria, { c1: 4, c2: 3, c3: 1 });
    expect(r.total).toBe(10);
    expect(r.earned).toBe(8);
  });

  it("clamps an over-award to maxPoints and a negative to zero", () => {
    const r = scoreRubric(criteria, { c1: 99, c2: -4 });
    expect(r.earned).toBe(5); // c1 clamped to 5, c2 to 0, c3 missing = 0
  });

  it("ignores unknown criterion ids", () => {
    const r = scoreRubric(criteria, { nope: 100, c3: 2 });
    expect(r.earned).toBe(2);
    expect(r.total).toBe(10);
  });

  it("missing criteria count as zero", () => {
    const r = scoreRubric(criteria, {});
    expect(r).toEqual({ earned: 0, total: 10 });
  });
});

describe("weightedPercent", () => {
  it("weights CA and exam into one percentage", () => {
    // CA: 8/10 = 80% at weight 40; Exam: 30/60 = 50% at weight 60 => 62%
    const pct = weightedPercent([
      { earned: 8, total: 10, weight: 40 },
      { earned: 30, total: 60, weight: 60 },
    ]);
    expect(pct).toBe(62);
  });

  it("drops components with no marks yet so they neither help nor hurt", () => {
    // Only CA graded so far (100%); exam not taken => result is the CA percentage.
    const pct = weightedPercent([
      { earned: 10, total: 10, weight: 40 },
      { earned: 0, total: 0, weight: 60 },
    ]);
    expect(pct).toBe(100);
  });

  it("returns 0 when nothing is gradable", () => {
    expect(weightedPercent([{ earned: 0, total: 0, weight: 50 }])).toBe(0);
    expect(weightedPercent([])).toBe(0);
  });

  it("rounds to one decimal place", () => {
    // 1/3 = 33.333% => 33.3
    expect(weightedPercent([{ earned: 1, total: 3, weight: 1 }])).toBe(33.3);
  });
});

describe("gradeFor", () => {
  it("maps percentages to the default bands", () => {
    expect(gradeFor(85)).toBe("A");
    expect(gradeFor(70)).toBe("A");
    expect(gradeFor(69.9)).toBe("B");
    expect(gradeFor(55)).toBe("C");
    expect(gradeFor(45)).toBe("D");
    expect(gradeFor(40)).toBe("E");
    expect(gradeFor(39)).toBe("F");
    expect(gradeFor(0)).toBe("F");
  });

  it("the pass mark lands on the lowest non-F band", () => {
    expect(gradeFor(DEFAULT_PASS_MARK)).not.toBe("F");
    expect(gradeFor(DEFAULT_PASS_MARK - 1)).toBe("F");
  });

  it("honours custom bands", () => {
    const bands = [
      { min: 50, grade: "PASS" },
      { min: 0, grade: "FAIL" },
    ];
    expect(gradeFor(50, bands)).toBe("PASS");
    expect(gradeFor(49, bands)).toBe("FAIL");
  });
});

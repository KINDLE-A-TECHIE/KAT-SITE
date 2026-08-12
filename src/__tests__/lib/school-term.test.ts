import { describe, it, expect } from "vitest";
import {
  parseTerm,
  formatTerm,
  normalizeSession,
  termEndsAt,
  termGraceEndsAt,
  isWithinTermWindow,
  termLifecycle,
  daysUntilTermEnds,
  termNumberForModule,
  TERM_LENGTH_WEEKS,
  TERM_GRACE_WEEKS,
} from "@/lib/school-term";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * parseTerm mirrors the A2 migration backfill. If it ever disagreed with the SQL that populated
 * the columns, a re-parse anywhere (billing, a report filter) would resolve a different licence than
 * the one a school actually paid for. These pin the parse the migration relied on.
 */
describe("parseTerm", () => {
  it("splits a full term string into session + term number", () => {
    expect(parseTerm("2025/2026 Term 1")).toEqual({ sessionLabel: "2025/2026", termNumber: 1 });
    expect(parseTerm("2025/2026 t2")).toEqual({ sessionLabel: "2025/2026", termNumber: 2 });
    expect(parseTerm("JSS Term 3")).toEqual({ sessionLabel: "JSS", termNumber: 3 });
  });

  it("collapses stray whitespace in the session label", () => {
    expect(parseTerm("  2025/2026   Term 1 ")).toEqual({ sessionLabel: "2025/2026", termNumber: 1 });
  });

  it("defaults to term 1 when no term marker is present", () => {
    expect(parseTerm("2025/2026")).toEqual({ sessionLabel: "2025/2026", termNumber: 1 });
    expect(parseTerm("Anything")).toEqual({ sessionLabel: "Anything", termNumber: 1 });
  });
});

describe("formatTerm", () => {
  it("round-trips with parseTerm", () => {
    const { sessionLabel, termNumber } = parseTerm("2025/2026 Term 2");
    expect(formatTerm(sessionLabel, termNumber)).toBe("2025/2026 Term 2");
  });
});

describe("normalizeSession", () => {
  it("treats case and stray spacing as the same session", () => {
    expect(normalizeSession("2025/2026")).toBe(normalizeSession("  2025/2026 "));
    expect(normalizeSession("JSS Blue")).toBe(normalizeSession("jss   blue"));
  });

  it("keeps genuinely different sessions distinct", () => {
    expect(normalizeSession("2025/2026")).not.toBe(normalizeSession("2026/2027"));
  });
});

describe("termNumberForModule", () => {
  it("maps 0-based module sortOrder to a 1-based term number", () => {
    expect(termNumberForModule(0)).toBe(1); // Term 1
    expect(termNumberForModule(1)).toBe(2); // Term 2
    expect(termNumberForModule(2)).toBe(3); // Term 3
  });
});

describe("term window", () => {
  it("ends exactly 15 weeks after the start", () => {
    const start = new Date("2025-01-06T00:00:00.000Z");
    const end = termEndsAt(start)!;
    const weeks = (end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000);
    expect(weeks).toBe(TERM_LENGTH_WEEKS);
  });

  it("has no window when the start is null (legacy / not scheduled)", () => {
    expect(termEndsAt(null)).toBeNull();
    expect(isWithinTermWindow(null, new Date())).toBe(true);
  });

  it("allows access from the start day through the grace period, and refuses after", () => {
    const start = new Date("2025-01-06T00:00:00.000Z");
    expect(isWithinTermWindow(start, start)).toBe(true);
    expect(isWithinTermWindow(start, new Date(start.getTime() + 7 * WEEK))).toBe(true); // week 7, active
    // Week 16 is past the 15-week end but INSIDE the 2-week grace, so access continues.
    expect(isWithinTermWindow(start, new Date(start.getTime() + 16 * WEEK))).toBe(true);
    // Past 15 + 2 = 17 weeks, access is refused.
    expect(isWithinTermWindow(start, new Date(start.getTime() + 18 * WEEK))).toBe(false);
  });

  it("is not yet open before the start", () => {
    const start = new Date("2025-01-06T00:00:00.000Z");
    const before = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    expect(isWithinTermWindow(start, before)).toBe(false);
  });
});

describe("term lifecycle", () => {
  const start = new Date("2025-01-06T00:00:00.000Z");

  it("grace ends 15 + 2 weeks after the start", () => {
    expect(termGraceEndsAt(start)!.getTime()).toBe(
      start.getTime() + (TERM_LENGTH_WEEKS + TERM_GRACE_WEEKS) * WEEK,
    );
    expect(termGraceEndsAt(null)).toBeNull();
  });

  it("classifies each phase of the lifecycle", () => {
    expect(termLifecycle(null, start)).toBe("UNLIMITED");
    expect(termLifecycle(start, new Date(start.getTime() - WEEK))).toBe("NOT_STARTED");
    expect(termLifecycle(start, new Date(start.getTime() + 7 * WEEK))).toBe("ACTIVE");
    expect(termLifecycle(start, new Date(start.getTime() + 16 * WEEK))).toBe("GRACE"); // in grace
    expect(termLifecycle(start, new Date(start.getTime() + 18 * WEEK))).toBe("EXPIRED"); // past grace
  });

  it("counts whole days until the nominal end (negative once past it)", () => {
    expect(daysUntilTermEnds(null)).toBeNull();
    // 14 days before the 15-week end.
    const twoWeeksBeforeEnd = new Date(termEndsAt(start)!.getTime() - 14 * 24 * 60 * 60 * 1000);
    expect(daysUntilTermEnds(start, twoWeeksBeforeEnd)).toBe(14);
    // A week past the nominal end -> negative.
    const weekAfterEnd = new Date(termEndsAt(start)!.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(daysUntilTermEnds(start, weekAfterEnd)).toBe(-7);
  });
});

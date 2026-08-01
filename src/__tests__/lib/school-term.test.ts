import { describe, it, expect } from "vitest";
import {
  parseTerm,
  formatTerm,
  normalizeSession,
  termEndsAt,
  isWithinTermWindow,
  termNumberForModule,
  TERM_LENGTH_WEEKS,
} from "@/lib/school-term";

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

  it("is inside the window on the start day and outside after 15 weeks", () => {
    const start = new Date("2025-01-06T00:00:00.000Z");
    expect(isWithinTermWindow(start, start)).toBe(true);
    const midway = new Date(start.getTime() + 7 * 7 * 24 * 60 * 60 * 1000); // week 7
    expect(isWithinTermWindow(start, midway)).toBe(true);
    const afterEnd = new Date(start.getTime() + 16 * 7 * 24 * 60 * 60 * 1000); // week 16
    expect(isWithinTermWindow(start, afterEnd)).toBe(false);
  });

  it("is not yet open before the start", () => {
    const start = new Date("2025-01-06T00:00:00.000Z");
    const before = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    expect(isWithinTermWindow(start, before)).toBe(false);
  });
});

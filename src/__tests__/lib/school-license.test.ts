import { describe, it, expect } from "vitest";
import { normalizeTerm } from "@/lib/school-license";

/**
 * Terms are free text typed by school admins, and the licence gate, the report filter, and the
 * class filter all compare them. If "2025/2026 T1 " and "2025/2026 t1" ever stopped matching, a
 * school could pay for a term and still be locked out of it. This pins the forgiving compare.
 */
describe("normalizeTerm", () => {
  it("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeTerm("  2025/2026  T1 ")).toBe("2025/2026 t1");
    expect(normalizeTerm("2025/2026 t1")).toBe("2025/2026 t1");
    expect(normalizeTerm("2025/2026\tTerm\n1")).toBe("2025/2026 term 1");
  });

  it("treats case and stray spacing differences as the same term", () => {
    expect(normalizeTerm("2025/2026 Term 1")).toBe(normalizeTerm("2025/2026   term 1"));
    expect(normalizeTerm("JSS Term 2 ")).toBe(normalizeTerm("jss term 2"));
  });

  it("keeps genuinely different terms distinct", () => {
    expect(normalizeTerm("2025/2026 Term 1")).not.toBe(normalizeTerm("2025/2026 Term 2"));
  });

  it("is idempotent", () => {
    const once = normalizeTerm("  Primary 4  Term 3 ");
    expect(normalizeTerm(once)).toBe(once);
  });
});

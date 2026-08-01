import { describe, it, expect } from "vitest";
import { formatJoinCode, schoolCodePrefix } from "@/lib/join-code";

describe("schoolCodePrefix", () => {
  it("takes the leading alphanumerics of the school name, uppercased", () => {
    expect(schoolCodePrefix("Demo Academy")).toBe("DEMO");
    expect(schoolCodePrefix("greenwood")).toBe("GREE");
  });

  it("strips spaces and punctuation before taking the prefix", () => {
    expect(schoolCodePrefix("St. Mary's College")).toBe("STMA");
  });

  it("falls back to SCH when the name has no usable letters or digits", () => {
    expect(schoolCodePrefix("   ")).toBe("SCH");
    expect(schoolCodePrefix("!!!")).toBe("SCH");
  });

  it("returns only [A-Z0-9], so it is safe to interpolate into a RegExp", () => {
    expect(schoolCodePrefix("A+B*C(D)")).toMatch(/^[A-Z0-9]+$/);
  });
});

describe("formatJoinCode", () => {
  it("hyphenates the school prefix and the class number for display", () => {
    expect(formatJoinCode("DEMO01")).toBe("DEMO-01");
    expect(formatJoinCode("SCH99")).toBe("SCH-99");
  });

  it("leaves legacy random codes untouched (letters and digits interleaved)", () => {
    // The old scheme produced things like "AB3K7M"; those must not gain a stray hyphen.
    expect(formatJoinCode("AB3K7M")).toBe("AB3K7M");
    expect(formatJoinCode("K9M2QP")).toBe("K9M2QP");
  });

  it("is idempotent-safe on an already public form (no letters-then-digits match on 3+ digit tails)", () => {
    expect(formatJoinCode("DEMO123")).toBe("DEMO-123");
  });
});

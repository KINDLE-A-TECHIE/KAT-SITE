import { describe, it, expect } from "vitest";
import { normalizeName, syntheticStudentEmail, splitName } from "@/lib/roster";

describe("normalizeName", () => {
  it("is case- and whitespace-insensitive", () => {
    expect(normalizeName("  Ada   OBI ")).toBe("ada obi");
    expect(normalizeName("ada obi")).toBe(normalizeName("Ada  Obi"));
  });
});

describe("syntheticStudentEmail", () => {
  it("is deterministic, the basis of idempotent re-imports", () => {
    const a = syntheticStudentEmail("school-1", "Ada Obi");
    const b = syntheticStudentEmail("school-1", "  ada   obi ");
    expect(a).toBe(b);
  });

  it("is scoped per school, the same name in two schools is two children", () => {
    expect(syntheticStudentEmail("school-1", "Ada Obi")).not.toBe(
      syntheticStudentEmail("school-2", "Ada Obi"),
    );
  });

  it("uses the reserved .invalid TLD so it can never receive mail", () => {
    expect(syntheticStudentEmail("school-1", "Ada Obi")).toMatch(/^student\.[a-f0-9]{32}@roster\.invalid$/);
  });

  it("distinguishes different children", () => {
    expect(syntheticStudentEmail("s", "Ada Obi")).not.toBe(syntheticStudentEmail("s", "Chidi Obi"));
  });
});

describe("splitName", () => {
  it("splits a plain 'First Last' name", () => {
    expect(splitName("Ada Obi")).toEqual({ firstName: "Ada", lastName: "Obi" });
  });

  it("handles the 'Last, First' roster convention (not a trailing comma)", () => {
    expect(splitName("Okafor, Chidi")).toEqual({ firstName: "Chidi", lastName: "Okafor" });
  });

  it("keeps multi-word last names", () => {
    expect(splitName("Ada van der Berg")).toEqual({ firstName: "Ada", lastName: "van der Berg" });
  });

  it("keeps multi-word first names in 'Last, First Middle'", () => {
    expect(splitName("Okafor, Chidi Emeka")).toEqual({ firstName: "Chidi Emeka", lastName: "Okafor" });
  });

  it("handles a single-word name", () => {
    expect(splitName("Ada")).toEqual({ firstName: "Ada", lastName: "" });
  });

  it("falls back sensibly on a dangling comma", () => {
    expect(splitName("Okafor,")).toEqual({ firstName: "Okafor,", lastName: "" });
  });
});

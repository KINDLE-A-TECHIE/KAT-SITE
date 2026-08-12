import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  CAPABILITIES_BY_DEPARTMENT,
  CAPABILITY_KEYS,
  ALL_CAPABILITY_KEYS,
  hasCapability,
  isCapabilityKey,
} from "@/lib/capabilities";

describe("capabilities catalogue", () => {
  it("has one catalogue entry per key, and keys are unique", () => {
    expect(new Set(CAPABILITY_KEYS).size).toBe(CAPABILITY_KEYS.length);
    expect(CAPABILITIES.map((c) => c.key).sort()).toEqual([...CAPABILITY_KEYS].sort());
    expect(ALL_CAPABILITY_KEYS).toEqual([...CAPABILITY_KEYS]);
  });

  it("partitions every capability into exactly one department group", () => {
    const grouped = [
      ...CAPABILITIES_BY_DEPARTMENT.B2C,
      ...CAPABILITIES_BY_DEPARTMENT.B2B,
      ...CAPABILITIES_BY_DEPARTMENT.CROSS,
    ].map((c) => c.key);
    expect(grouped.sort()).toEqual([...CAPABILITY_KEYS].sort());
  });

  it("validates keys", () => {
    expect(isCapabilityKey("payments")).toBe(true);
    expect(isCapabilityKey("schools")).toBe(true);
    expect(isCapabilityKey("not-a-real-key")).toBe(false);
    expect(isCapabilityKey(42)).toBe(false);
  });
});

describe("hasCapability", () => {
  it("never restricts a super-admin", () => {
    for (const key of CAPABILITY_KEYS) {
      expect(hasCapability({ role: "SUPER_ADMIN", permissions: [] }, key)).toBe(true);
    }
  });

  it("grants an admin only its granted areas", () => {
    const user = { role: "ADMIN", permissions: ["payments", "analytics"] };
    expect(hasCapability(user, "payments")).toBe(true);
    expect(hasCapability(user, "analytics")).toBe(true);
    expect(hasCapability(user, "schools")).toBe(false);
    expect(hasCapability(user, "curriculum")).toBe(false);
  });

  it("treats an admin/instructor with no permissions as having no areas", () => {
    expect(hasCapability({ role: "ADMIN", permissions: [] }, "payments")).toBe(false);
    expect(hasCapability({ role: "INSTRUCTOR", permissions: undefined }, "curriculum")).toBe(false);
  });

  it("returns false for non-staff roles and for no user", () => {
    expect(hasCapability({ role: "STUDENT", permissions: ["payments"] }, "payments")).toBe(false);
    expect(hasCapability({ role: "PARENT" }, "payments")).toBe(false);
    expect(hasCapability(null, "payments")).toBe(false);
    expect(hasCapability(undefined, "payments")).toBe(false);
  });
});

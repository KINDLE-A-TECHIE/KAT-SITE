import { describe, it, expect } from "vitest";
import { safeRedirect, resolveLoginRedirect } from "@/lib/safe-redirect";

describe("safeRedirect", () => {
  it("allows a same-site absolute path", () => {
    expect(safeRedirect("/teach")).toBe("/teach");
    expect(safeRedirect("/dashboard/grades?tab=1")).toBe("/dashboard/grades?tab=1");
  });

  it("rejects an external absolute URL (open redirect)", () => {
    expect(safeRedirect("https://evil.com")).toBeNull();
    expect(safeRedirect("http://evil.com/teach")).toBeNull();
  });

  it("rejects a protocol-relative URL (open redirect)", () => {
    expect(safeRedirect("//evil.com")).toBeNull();
    expect(safeRedirect("//evil.com/teach")).toBeNull();
  });

  it("rejects a backslash-prefixed path", () => {
    expect(safeRedirect("/\\evil.com")).toBeNull();
  });

  it("rejects a javascript: scheme", () => {
    expect(safeRedirect("javascript:alert(1)")).toBeNull();
  });

  it("rejects empty / nullish input", () => {
    expect(safeRedirect(null)).toBeNull();
    expect(safeRedirect(undefined)).toBeNull();
    expect(safeRedirect("")).toBeNull();
  });
});

describe("resolveLoginRedirect", () => {
  it("prefers callbackUrl (what NextAuth/middleware send)", () => {
    expect(resolveLoginRedirect("/teach", "/dashboard/grades")).toBe("/teach");
  });

  it("falls back to redirect (used by our internal links)", () => {
    expect(resolveLoginRedirect(null, "/dashboard/fellows/apply")).toBe("/dashboard/fellows/apply");
  });

  it("falls back to /dashboard when neither is present", () => {
    expect(resolveLoginRedirect(null, null)).toBe("/dashboard");
  });

  it("skips an unsafe callbackUrl and uses the safe redirect param", () => {
    expect(resolveLoginRedirect("https://evil.com", "/dashboard/grades")).toBe("/dashboard/grades");
  });

  it("falls back to /dashboard when both are unsafe", () => {
    expect(resolveLoginRedirect("https://evil.com", "//evil.com")).toBe("/dashboard");
  });
});

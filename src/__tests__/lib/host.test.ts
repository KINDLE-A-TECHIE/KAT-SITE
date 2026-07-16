import { describe, it, expect } from "vitest";
import { isSchoolHost, requiresAuth, schoolRootTarget } from "@/lib/host";

describe("isSchoolHost", () => {
  it("true for the production school host", () => {
    expect(isSchoolHost("schools.kindleatechie.com")).toBe(true);
  });

  it("true for the dev simulation host (schools.localhost with port)", () => {
    expect(isSchoolHost("schools.localhost:3000")).toBe(true);
  });

  it("false for the apex B2C host", () => {
    expect(isSchoolHost("kindleatechie.com")).toBe(false);
  });

  it("false for www and plain localhost", () => {
    expect(isSchoolHost("www.kindleatechie.com")).toBe(false);
    expect(isSchoolHost("localhost:3000")).toBe(false);
  });

  it("false for null / empty / undefined", () => {
    expect(isSchoolHost(null)).toBe(false);
    expect(isSchoolHost("")).toBe(false);
    expect(isSchoolHost(undefined)).toBe(false);
  });

  it("not fooled by a lookalike that merely contains 'schools'", () => {
    expect(isSchoolHost("myschools.com")).toBe(false);
  });
});

describe("requiresAuth (login-gating)", () => {
  it("gates /dashboard and its subpaths (B2C, unchanged)", () => {
    expect(requiresAuth("/dashboard")).toBe(true);
    expect(requiresAuth("/dashboard/payments")).toBe(true);
  });

  it("gates the school app areas", () => {
    for (const p of ["/admin", "/teach", "/learn"]) {
      expect(requiresAuth(p)).toBe(true);
      expect(requiresAuth(p + "/anything")).toBe(true);
    }
  });

  it("does NOT gate public paths (marketing, auth, school hub)", () => {
    for (const p of ["/", "/schools", "/login", "/register", "/partners", "/home"]) {
      expect(requiresAuth(p)).toBe(false);
    }
  });

  it("does NOT gate a lookalike like /administrator", () => {
    expect(requiresAuth("/administrator")).toBe(false);
  });
});

describe("schoolRootTarget", () => {
  it("logged-out prospect gets the public B2B marketing landing", () => {
    expect(schoolRootTarget(false)).toBe("/schools");
  });

  it("logged-in user gets the workspace hub (routes by role in the page)", () => {
    expect(schoolRootTarget(true)).toBe("/home");
  });
});

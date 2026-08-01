import { describe, it, expect } from "vitest";
import { scratchProjectKey, isOwnScratchKey, SCRATCH_KEY_PREFIX } from "@/lib/scratch-storage";

describe("scratchProjectKey", () => {
  it("namespaces the key by user and content and ends in .sb3", () => {
    const key = scratchProjectKey("user_123", "content_abc");
    expect(key.startsWith(`${SCRATCH_KEY_PREFIX}/user_123/content_abc/`)).toBe(true);
    expect(key.endsWith(".sb3")).toBe(true);
  });

  it("is unique per call", () => {
    expect(scratchProjectKey("u", "c")).not.toBe(scratchProjectKey("u", "c"));
  });

  it("a freshly minted key is owned by that user", () => {
    const key = scratchProjectKey("u1", "c1");
    expect(isOwnScratchKey(key, "u1")).toBe(true);
  });
});

describe("isOwnScratchKey", () => {
  it("accepts only this user's keys", () => {
    expect(isOwnScratchKey("scratch-projects/u1/c1/abc.sb3", "u1")).toBe(true);
    expect(isOwnScratchKey("scratch-projects/u2/c1/abc.sb3", "u1")).toBe(false);
  });

  it("the trailing slash stops a prefix-confusion match (u1 vs u1extra)", () => {
    expect(isOwnScratchKey("scratch-projects/u1extra/c/abc.sb3", "u1")).toBe(false);
  });

  it("rejects path traversal, wrong extension, and non-strings", () => {
    expect(isOwnScratchKey("scratch-projects/u1/../u2/c/abc.sb3", "u1")).toBe(false);
    expect(isOwnScratchKey("scratch-projects/u1/c/abc.txt", "u1")).toBe(false);
    expect(isOwnScratchKey("other/u1/c/abc.sb3", "u1")).toBe(false);
    expect(isOwnScratchKey("", "u1")).toBe(false);
    expect(isOwnScratchKey(null, "u1")).toBe(false);
    expect(isOwnScratchKey(42, "u1")).toBe(false);
  });
});

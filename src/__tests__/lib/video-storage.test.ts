import { describe, expect, it } from "vitest";
import { stageVideoKey, isOwnStageVideoKey, VIDEO_PREFIX, MAX_STAGE_VIDEO_BYTES } from "@/lib/video-storage";

describe("stageVideoKey", () => {
  it("mints a key under the user's own namespace ending in .webm", () => {
    const key = stageVideoKey("user-123");
    expect(key.startsWith(`${VIDEO_PREFIX}/user-123/`)).toBe(true);
    expect(key.endsWith(".webm")).toBe(true);
  });

  it("mints a fresh (unique) key each call", () => {
    expect(stageVideoKey("u")).not.toBe(stageVideoKey("u"));
  });
});

describe("isOwnStageVideoKey", () => {
  it("accepts one of THIS user's keys", () => {
    const key = stageVideoKey("user-123");
    expect(isOwnStageVideoKey(key, "user-123")).toBe(true);
  });

  it("rejects another user's key", () => {
    const key = stageVideoKey("user-123");
    expect(isOwnStageVideoKey(key, "user-999")).toBe(false);
  });

  it("rejects a prefix-collision (abc must not match abcd)", () => {
    expect(isOwnStageVideoKey("videos/abcd/x.webm", "abc")).toBe(false);
  });

  it("rejects path traversal and the wrong extension", () => {
    expect(isOwnStageVideoKey("videos/u/../other/x.webm", "u")).toBe(false);
    expect(isOwnStageVideoKey("videos/u/x.sb3", "u")).toBe(false);
    expect(isOwnStageVideoKey("videos/u/x.webm.txt", "u")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isOwnStageVideoKey(null, "u")).toBe(false);
    expect(isOwnStageVideoKey(42, "u")).toBe(false);
    expect(isOwnStageVideoKey(undefined, "u")).toBe(false);
  });

  it("exposes a sane size cap", () => {
    expect(MAX_STAGE_VIDEO_BYTES).toBeGreaterThan(0);
  });
});

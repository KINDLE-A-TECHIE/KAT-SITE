import { afterEach, describe, expect, it } from "vitest";
import {
  SCRATCH_MSG,
  getScratchEditorUrl,
  isScratchEnabled,
  isTrustedScratchMessage,
  loadMessage,
  parseScratchInbound,
  saveMessage,
  scratchEditorOrigin,
  videoUploadUrlMessage,
  videoUploadDeniedMessage,
} from "@/lib/scratch";

const ENV_KEY = "NEXT_PUBLIC_SCRATCH_EDITOR_URL";
const original = process.env[ENV_KEY];

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
});

describe("scratch flag + origin", () => {
  it("is disabled when the editor URL is unset", () => {
    delete process.env[ENV_KEY];
    expect(getScratchEditorUrl()).toBeNull();
    expect(isScratchEnabled()).toBe(false);
    expect(scratchEditorOrigin()).toBeNull();
  });

  it("reads the editor URL and derives its origin, trimming a trailing slash", () => {
    process.env[ENV_KEY] = "https://scratch.kindleatechie.com/";
    expect(getScratchEditorUrl()).toBe("https://scratch.kindleatechie.com");
    expect(isScratchEnabled()).toBe(true);
    expect(scratchEditorOrigin()).toBe("https://scratch.kindleatechie.com");
  });

  it("fails closed (null origin) on a malformed URL", () => {
    process.env[ENV_KEY] = "not a url";
    expect(scratchEditorOrigin()).toBeNull();
  });
});

describe("isTrustedScratchMessage", () => {
  const origin = "https://scratch.kindleatechie.com";

  it("accepts an object message from the expected origin", () => {
    expect(isTrustedScratchMessage({ origin, data: { type: SCRATCH_MSG.READY } }, origin)).toBe(true);
  });

  it("rejects a message from any other origin", () => {
    expect(isTrustedScratchMessage({ origin: "https://evil.example", data: {} }, origin)).toBe(false);
  });

  it("rejects when no origin is expected (fails closed)", () => {
    expect(isTrustedScratchMessage({ origin, data: {} }, null)).toBe(false);
  });

  it("rejects a non-object payload", () => {
    expect(isTrustedScratchMessage({ origin, data: "ready" }, origin)).toBe(false);
  });
});

describe("parseScratchInbound", () => {
  it("parses READY and DIRTY", () => {
    expect(parseScratchInbound({ type: SCRATCH_MSG.READY })).toEqual({ type: SCRATCH_MSG.READY });
    expect(parseScratchInbound({ type: SCRATCH_MSG.DIRTY })).toEqual({ type: SCRATCH_MSG.DIRTY });
  });

  it("parses SAVED only with a non-empty key", () => {
    expect(parseScratchInbound({ type: SCRATCH_MSG.SAVED, key: "school/x/proj.sb3" })).toEqual({
      type: SCRATCH_MSG.SAVED,
      key: "school/x/proj.sb3",
    });
    expect(parseScratchInbound({ type: SCRATCH_MSG.SAVED, key: "" })).toBeNull();
    expect(parseScratchInbound({ type: SCRATCH_MSG.SAVED })).toBeNull();
  });

  it("parses SAVE_FAILED with a fallback message", () => {
    expect(parseScratchInbound({ type: SCRATCH_MSG.SAVE_FAILED, message: "R2 down" })).toEqual({
      type: SCRATCH_MSG.SAVE_FAILED,
      message: "R2 down",
    });
    expect(parseScratchInbound({ type: SCRATCH_MSG.SAVE_FAILED })).toEqual({
      type: SCRATCH_MSG.SAVE_FAILED,
      message: "Save failed.",
    });
  });

  it("parses REQUEST_SAVE and REQUEST_LOAD (the editor's File -> Save / Open)", () => {
    expect(parseScratchInbound({ type: SCRATCH_MSG.REQUEST_SAVE })).toEqual({ type: SCRATCH_MSG.REQUEST_SAVE });
    expect(parseScratchInbound({ type: SCRATCH_MSG.REQUEST_LOAD })).toEqual({ type: SCRATCH_MSG.REQUEST_LOAD });
  });

  it("parses REQUEST_VIDEO_UPLOAD only with a positive numeric size", () => {
    expect(parseScratchInbound({ type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD, sizeBytes: 1024, durationMs: 4200 })).toEqual({
      type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD,
      sizeBytes: 1024,
      durationMs: 4200,
    });
    // durationMs is optional: absent or invalid becomes null.
    expect(parseScratchInbound({ type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD, sizeBytes: 5 })).toEqual({
      type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD,
      sizeBytes: 5,
      durationMs: null,
    });
    expect(parseScratchInbound({ type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD, sizeBytes: 0 })).toBeNull();
    expect(parseScratchInbound({ type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD, sizeBytes: -3 })).toBeNull();
    expect(parseScratchInbound({ type: SCRATCH_MSG.REQUEST_VIDEO_UPLOAD })).toBeNull();
  });

  it("parses VIDEO_SAVED only with a non-empty key AND a positive size", () => {
    expect(parseScratchInbound({ type: SCRATCH_MSG.VIDEO_SAVED, key: "videos/u/x.webm", sizeBytes: 900, durationMs: 3000 })).toEqual({
      type: SCRATCH_MSG.VIDEO_SAVED,
      key: "videos/u/x.webm",
      sizeBytes: 900,
      durationMs: 3000,
    });
    expect(parseScratchInbound({ type: SCRATCH_MSG.VIDEO_SAVED, key: "", sizeBytes: 900 })).toBeNull();
    expect(parseScratchInbound({ type: SCRATCH_MSG.VIDEO_SAVED, key: "videos/u/x.webm", sizeBytes: 0 })).toBeNull();
  });

  it("parses VIDEO_SAVE_FAILED with a fallback message", () => {
    expect(parseScratchInbound({ type: SCRATCH_MSG.VIDEO_SAVE_FAILED, message: "429" })).toEqual({
      type: SCRATCH_MSG.VIDEO_SAVE_FAILED,
      message: "429",
    });
    expect(parseScratchInbound({ type: SCRATCH_MSG.VIDEO_SAVE_FAILED })).toEqual({
      type: SCRATCH_MSG.VIDEO_SAVE_FAILED,
      message: "Recording save failed.",
    });
  });

  it("returns null for unknown or non-object payloads", () => {
    expect(parseScratchInbound({ type: "kat:scratch:load" })).toBeNull(); // an outbound type, not inbound
    expect(parseScratchInbound({ type: "something-else" })).toBeNull();
    expect(parseScratchInbound(null)).toBeNull();
    expect(parseScratchInbound("ready")).toBeNull();
  });
});

describe("outbound builders", () => {
  it("builds LOAD with a project URL or null for a blank project", () => {
    expect(loadMessage("https://cdn.example/p.sb3")).toEqual({
      type: SCRATCH_MSG.LOAD,
      projectUrl: "https://cdn.example/p.sb3",
    });
    expect(loadMessage(null)).toEqual({ type: SCRATCH_MSG.LOAD, projectUrl: null });
  });

  it("builds SAVE with the presigned upload URL and key", () => {
    expect(saveMessage("https://r2.example/put?sig=1", "school/x/proj.sb3")).toEqual({
      type: SCRATCH_MSG.SAVE,
      uploadUrl: "https://r2.example/put?sig=1",
      key: "school/x/proj.sb3",
    });
  });

  it("builds VIDEO_UPLOAD_URL and VIDEO_UPLOAD_DENIED", () => {
    expect(videoUploadUrlMessage("https://r2.example/put?sig=2", "videos/u/x.webm")).toEqual({
      type: SCRATCH_MSG.VIDEO_UPLOAD_URL,
      uploadUrl: "https://r2.example/put?sig=2",
      key: "videos/u/x.webm",
    });
    expect(videoUploadDeniedMessage("Too many recordings")).toEqual({
      type: SCRATCH_MSG.VIDEO_UPLOAD_DENIED,
      message: "Too many recordings",
    });
  });
});

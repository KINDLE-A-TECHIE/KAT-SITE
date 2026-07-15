import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// MeetingStatus values, matches the Prisma enum
const MeetingStatus = {
  UPCOMING: "UPCOMING",
  LIVE: "LIVE",
  ENDED: "ENDED",
} as const;

vi.mock("@prisma/client", () => ({
  MeetingStatus: { UPCOMING: "UPCOMING", LIVE: "LIVE", ENDED: "ENDED", CANCELLED: "CANCELLED" },
}));

import {
  isJitsiConfigured,
  generateRoomName,
  getMeetingStatus,
  buildJitsiJoinUrl,
  buildJitsiBaseUrl,
} from "@/lib/jitsi";

const JITSI_ENV = {
  JITSI_APP_ID: "test-app-id",
  JITSI_APP_SECRET: "test-app-secret",
  JITSI_DOMAIN: "meet.example.com",
};

function setJitsiEnv(overrides: Partial<typeof JITSI_ENV> = {}) {
  Object.assign(process.env, { ...JITSI_ENV, ...overrides });
}

function clearJitsiEnv() {
  delete process.env.JITSI_APP_ID;
  delete process.env.JITSI_APP_SECRET;
  delete process.env.JITSI_DOMAIN;
}

const testUser = {
  userId: "user-123",
  name: "Alice Nwosu",
  email: "alice@kat.io",
  avatarUrl: null,
  isModerator: false,
};

describe("isJitsiConfigured", () => {
  afterEach(clearJitsiEnv);

  it("returns true when all three env vars are set", () => {
    setJitsiEnv();
    expect(isJitsiConfigured()).toBe(true);
  });

  it("returns false when JITSI_APP_ID is missing", () => {
    setJitsiEnv({ JITSI_APP_ID: undefined as unknown as string });
    delete process.env.JITSI_APP_ID;
    expect(isJitsiConfigured()).toBe(false);
  });

  it("returns false when JITSI_APP_SECRET is missing", () => {
    setJitsiEnv();
    delete process.env.JITSI_APP_SECRET;
    expect(isJitsiConfigured()).toBe(false);
  });

  it("returns false when JITSI_DOMAIN is missing", () => {
    setJitsiEnv();
    delete process.env.JITSI_DOMAIN;
    expect(isJitsiConfigured()).toBe(false);
  });
});

describe("generateRoomName", () => {
  it("always starts with 'kat-'", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateRoomName()).toMatch(/^kat-/);
    }
  });

  it("is 16 characters long (4 prefix + 12 suffix)", () => {
    expect(generateRoomName()).toHaveLength(16);
  });

  it("uses only lowercase alphanumeric characters after the prefix", () => {
    const name = generateRoomName();
    expect(name.slice(4)).toMatch(/^[a-z0-9]{12}$/);
  });

  it("generates unique names", () => {
    const names = new Set(Array.from({ length: 50 }, generateRoomName));
    expect(names.size).toBe(50);
  });
});

describe("getMeetingStatus", () => {
  it("returns UPCOMING when start time is in the future", () => {
    const start = new Date(Date.now() + 60_000);
    const end = new Date(Date.now() + 120_000);
    expect(getMeetingStatus(start, end)).toBe(MeetingStatus.UPCOMING);
  });

  it("returns LIVE when current time is between start and end", () => {
    const start = new Date(Date.now() - 60_000);
    const end = new Date(Date.now() + 60_000);
    expect(getMeetingStatus(start, end)).toBe(MeetingStatus.LIVE);
  });

  it("returns ENDED when end time is in the past", () => {
    const start = new Date(Date.now() - 120_000);
    const end = new Date(Date.now() - 60_000);
    expect(getMeetingStatus(start, end)).toBe(MeetingStatus.ENDED);
  });

  it("returns LIVE exactly at start time", () => {
    const now = Date.now();
    const start = new Date(now - 1); // 1 ms ago
    const end = new Date(now + 60_000);
    expect(getMeetingStatus(start, end)).toBe(MeetingStatus.LIVE);
  });
});

describe("buildJitsiJoinUrl", () => {
  beforeEach(() => setJitsiEnv());
  afterEach(clearJitsiEnv);

  it("produces a URL on the configured domain", () => {
    const url = buildJitsiJoinUrl("kat-roomabc123", testUser);
    expect(url).toMatch(/^https:\/\/meet\.example\.com\/kat-roomabc123\?jwt=/);
  });

  it("includes a JWT query parameter", () => {
    const url = buildJitsiJoinUrl("kat-testrm12", testUser);
    const jwt = new URL(url).searchParams.get("jwt");
    expect(jwt).toBeTruthy();
    // A valid HS256 JWT has three base64url segments separated by dots
    expect(jwt!.split(".")).toHaveLength(3);
  });

  it("encodes the user as moderator when isModerator is true", () => {
    const url = buildJitsiJoinUrl("kat-testrm12", { ...testUser, isModerator: true });
    const jwt = new URL(url).searchParams.get("jwt")!;
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    expect(payload.context.user.moderator).toBe(true);
  });

  it("encodes the correct room name in the JWT payload", () => {
    const url = buildJitsiJoinUrl("kat-abc123456789", testUser);
    const jwt = new URL(url).searchParams.get("jwt")!;
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    expect(payload.room).toBe("kat-abc123456789");
  });

  it("sets expiry ~4 hours from now", () => {
    const before = Math.floor(Date.now() / 1000);
    const url = buildJitsiJoinUrl("kat-testrm12", testUser);
    const after = Math.floor(Date.now() / 1000);
    const jwt = new URL(url).searchParams.get("jwt")!;
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    const expectedExp = before + 4 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(expectedExp - 1);
    expect(payload.exp).toBeLessThanOrEqual(after + 4 * 60 * 60 + 1);
  });

  it("throws when Jitsi is not configured", () => {
    clearJitsiEnv();
    expect(() => buildJitsiJoinUrl("kat-room", testUser)).toThrow(
      "Jitsi is not configured",
    );
  });
});

describe("buildJitsiBaseUrl", () => {
  afterEach(clearJitsiEnv);

  it("returns the room URL without a JWT", () => {
    process.env.JITSI_DOMAIN = "meet.example.com";
    expect(buildJitsiBaseUrl("kat-myroom")).toBe("https://meet.example.com/kat-myroom");
  });

  it("throws when JITSI_DOMAIN is not set", () => {
    delete process.env.JITSI_DOMAIN;
    expect(() => buildJitsiBaseUrl("kat-myroom")).toThrow("JITSI_DOMAIN is not set");
  });
});

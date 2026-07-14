import { describe, it, expect, afterEach } from "vitest";
import {
  normalizeEmail,
  generateAdminInviteToken,
  hashAdminInviteToken,
  buildAdminInviteUrl,
  getAdminInviteStatus,
} from "@/lib/admin-invite";

describe("normalizeEmail", () => {
  it("lowercases the email", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  admin@kat.io  ")).toBe("admin@kat.io");
  });

  it("handles already-normalised input unchanged", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });
});

describe("generateAdminInviteToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateAdminInviteToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique values on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, generateAdminInviteToken));
    expect(tokens.size).toBe(20);
  });
});

describe("hashAdminInviteToken", () => {
  it("returns a 64-character hex SHA-256 digest", () => {
    const hash = hashAdminInviteToken("sometoken");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashAdminInviteToken("abc")).toBe(hashAdminInviteToken("abc"));
  });

  it("produces different output for different inputs", () => {
    expect(hashAdminInviteToken("abc")).not.toBe(hashAdminInviteToken("xyz"));
  });
});

describe("buildAdminInviteUrl", () => {
  const originalUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalUrl;
  });

  it("uses NEXTAUTH_URL as the base", () => {
    process.env.NEXTAUTH_URL = "https://app.kat.io";
    const url = buildAdminInviteUrl("mytoken");
    expect(url).toMatch(/^https:\/\/app\.kat\.io\/register\/staff\?token=/);
  });

  it("falls back to localhost:3000 when NEXTAUTH_URL is not set", () => {
    delete process.env.NEXTAUTH_URL;
    const url = buildAdminInviteUrl("mytoken");
    expect(url).toMatch(/^http:\/\/localhost:3000\/register\/staff\?token=/);
  });

  it("percent-encodes special characters in the token", () => {
    const url = buildAdminInviteUrl("tok en+val/ue");
    expect(url).toContain("tok%20en%2Bval%2Fue");
  });

  it("includes the token in the query string", () => {
    const url = buildAdminInviteUrl("abc123");
    expect(url).toContain("token=abc123");
  });
});

describe("getAdminInviteStatus", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  const past = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  it("returns 'revoked' when revokedAt is set", () => {
    expect(
      getAdminInviteStatus({ expiresAt: future, revokedAt: new Date() }),
    ).toBe("revoked");
  });

  it("returns 'used' when usedAt is set (and not revoked)", () => {
    expect(
      getAdminInviteStatus({ expiresAt: future, usedAt: new Date() }),
    ).toBe("used");
  });

  it("returns 'expired' when expiresAt is in the past", () => {
    expect(getAdminInviteStatus({ expiresAt: past })).toBe("expired");
  });

  it("returns 'valid' when none of the above conditions are met", () => {
    expect(getAdminInviteStatus({ expiresAt: future })).toBe("valid");
  });

  it("prioritises 'revoked' over 'used'", () => {
    expect(
      getAdminInviteStatus({
        expiresAt: future,
        revokedAt: new Date(),
        usedAt: new Date(),
      }),
    ).toBe("revoked");
  });

  it("prioritises 'used' over 'expired'", () => {
    expect(
      getAdminInviteStatus({ expiresAt: past, usedAt: new Date() }),
    ).toBe("used");
  });
});

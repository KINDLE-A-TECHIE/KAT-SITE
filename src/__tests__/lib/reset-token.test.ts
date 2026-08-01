import { describe, it, expect } from "vitest";
import { generateResetToken, hashResetToken } from "@/lib/reset-token";

// Account setup / password-reset tokens are bearer secrets emailed in a link. The raw token must be
// crypto-random (never a cuid), and the DB must store only its hash so a leak yields nothing usable.
// This suite pins that contract for every flow that uses it (forgot-password, fellow/teacher/school
// setup). Redeem = look up by hashResetToken(rawFromUrl).

describe("reset/setup token", () => {
  it("raw token is 64 lowercase hex chars (256-bit crypto), not a cuid", () => {
    const raw = generateResetToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    // cuid v1 starts with 'c' and is 25 chars; a 64-hex token cannot be mistaken for one.
    expect(raw.length).toBe(64);
  });

  it("stores the hash, never the raw value (a DB leak must not expose usable tokens)", () => {
    const raw = generateResetToken();
    const stored = hashResetToken(raw);
    expect(stored).not.toBe(raw);
    expect(stored).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("hash is deterministic so redeem can re-derive it from the URL value", () => {
    const raw = generateResetToken();
    expect(hashResetToken(raw)).toBe(hashResetToken(raw));
  });

  it("different tokens hash to different values (no collisions across 20000 draws)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(hashResetToken(generateResetToken()));
    expect(seen.size).toBe(20000);
  });
});

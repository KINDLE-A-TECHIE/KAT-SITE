import { describe, it, expect } from "vitest";
import { generateCredentialId } from "@/lib/certificate";

// The credential id is the WHOLE of a PUBLIC, unauthenticated verification URL that returns the
// recipient's name and programme, so it must be UNGUESSABLE: crypto (randomUUID), never a cuid or
// Math.random. This suite pins the format and the entropy/collision-resistance that buys.

function utcStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

describe("certificate credential id", () => {
  it("is KAT-CERT-YYYYMMDD-<16 hex> with a 16 uppercase-hex crypto suffix", () => {
    const value = generateCredentialId();
    expect(value).toMatch(/^KAT-CERT-\d{8}-[0-9A-F]{16}$/);
    expect(value).toContain(`KAT-CERT-${utcStamp()}-`);
  });

  it("does not look like the old cuid default (which is guessable/enumerable)", () => {
    // cuid v1 is a lowercase, dash-free string starting with 'c'. A public verification url must
    // not be a cuid: it embeds a timestamp and draws its random block from Math.random.
    const value = generateCredentialId();
    expect(value.startsWith("c")).toBe(false);
    expect(value).toContain("-");
  });

  it("20000 values are all unique (collision-resistant, unlike Math.random)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(generateCredentialId());
    expect(seen.size).toBe(20000);
  });

  it("the crypto suffix varies every call (high entropy, not timestamp-derived)", () => {
    // A timestamp-only suffix would repeat across rapid calls. 100 draws from a 64-bit crypto space
    // essentially never collide, so all 100 suffixes must be distinct.
    const suffixes = new Set(Array.from({ length: 100 }, () => generateCredentialId().slice(-16)));
    expect(suffixes.size).toBe(100);
  });
});

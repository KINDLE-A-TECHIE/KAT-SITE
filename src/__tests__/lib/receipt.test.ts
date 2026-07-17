import { describe, it, expect } from "vitest";
import {
  generateReceiptNumber,
  generatePaymentReference,
  generateBatchReference,
  generateInvoiceReference,
} from "@/lib/payments/receipt";

// These identifiers back UNIQUE columns written without a retry loop, so a collision throws and
// fails a payment side effect. They must come from crypto (randomUUID), never Math.random. This
// suite pins the format and, more importantly, the collision-resistance the crypto suffix buys.

const CASES = [
  { name: "receipt", fn: generateReceiptNumber, prefix: "RCP" },
  { name: "payment reference", fn: generatePaymentReference, prefix: "PAY" },
  { name: "batch reference", fn: generateBatchReference, prefix: "BATCH" },
  { name: "invoice reference", fn: generateInvoiceReference, prefix: "SCH" },
] as const;

function utcStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

describe("payment identifier generators", () => {
  for (const { name, fn, prefix } of CASES) {
    it(`${name}: KAT-${prefix}-YYYYMMDD-<16 hex> with a 16 uppercase-hex crypto suffix`, () => {
      const value = fn();
      expect(value).toMatch(new RegExp(`^KAT-${prefix}-\\d{8}-[0-9A-F]{16}$`));
      expect(value).toContain(`KAT-${prefix}-${utcStamp()}-`);
    });

    it(`${name}: 20000 values are all unique (collision-resistant, unlike Math.random)`, () => {
      // With a 64-bit crypto suffix the birthday-collision probability at 20000 draws is ~1e-11, so
      // this is a genuine guarantee, not a coin flip (an 8-hex suffix made it flake ~5% of runs).
      const seen = new Set<string>();
      for (let i = 0; i < 20000; i++) seen.add(fn());
      expect(seen.size).toBe(20000);
    });
  }

  it("prefixes are distinct so B2C vs school pipelines are tellable at a glance", () => {
    const prefixes = CASES.map((c) => c.fn().split("-")[1]);
    expect(new Set(prefixes).size).toBe(CASES.length);
  });
});

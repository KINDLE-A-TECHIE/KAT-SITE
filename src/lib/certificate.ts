import { randomUUID } from "node:crypto";

/**
 * Public certificate credential ID. `KAT-CERT-YYYYMMDD-<16 hex>`, crypto-random.
 *
 * This id is the WHOLE of a public, unauthenticated verification URL (/certificate/<id>
 * and /api/certificates/verify/<id>), which returns the recipient's name and programme.
 * It must therefore be UNGUESSABLE. The old schema default `@default(cuid())` is not:
 * cuid v1 embeds a timestamp and draws its random block from `Math.random()`, so a guessed
 * or enumerated id would leak who holds which certificate. `crypto.randomUUID()` gives 64
 * bits of CSPRNG entropy here, infeasible to guess or brute-force online, and backs the
 * UNIQUE `credentialId` column with negligible collision risk at certificate volumes.
 */
export function generateCredentialId(): string {
  const now = new Date();
  const stamp =
    `${now.getUTCFullYear()}` +
    `${String(now.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(now.getUTCDate()).padStart(2, "0")}`;
  const suffix = randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
  return `KAT-CERT-${stamp}-${suffix}`;
}

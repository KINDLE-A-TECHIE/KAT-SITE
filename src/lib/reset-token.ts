import "server-only";
import crypto from "crypto";

/**
 * Account setup / password-reset tokens (PasswordResetToken).
 *
 * Same at-rest posture as the admin/super-admin invites: the raw token is a 256-bit
 * CSPRNG value that only ever lives in the emailed link, and the DB stores its SHA-256
 * hash, so a database leak yields no usable tokens. Every create site stores
 * hashResetToken(raw) and puts the raw value in the URL; the redeem site looks the row
 * up by hashResetToken(rawFromUrl).
 */
export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

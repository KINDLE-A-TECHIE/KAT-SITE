import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { SchoolApiScope } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * School API keys, the credential a school's SERVER uses against the public v1 API and the embed.
 *
 * Stripe-shaped: the full secret is shown ONCE at creation and never stored. We keep a SHA-256 of
 * it plus a short prefix, so a UI can display `kat_sk_a1b2…` while holding nothing sensitive.
 *
 * THIS KEY MUST NEVER REACH A BROWSER. Depending on scope it can create child accounts or sign in
 * as any pupil in the school, so a key pasted into a page's <script> is a key that lets any visitor
 * impersonate any child.
 *
 * SCOPES exist because those two powers have wildly different blast radii from "read a report", and
 * a school will hand the same key to a BI contractor without thinking. REVOCATION IS SOFT, a hard
 * delete destroys the record of what a leaked key actually did, which is precisely what you need to
 * read afterwards.
 */

const KEY_PREFIX = "kat_sk_";
const PREFIX_DISPLAY_LEN = 12; // "kat_sk_a1b2c", enough to recognise, useless to an attacker

/** SHA-256, not bcrypt: this is a 256-bit random secret, not a human password. It has no entropy
 *  problem to stretch away, and key verification is on the hot path of every API call. */
function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type IssuedKey = { id: string; secret: string; prefix: string };

export async function issueSchoolApiKey(
  schoolId: string,
  name: string,
  scopes: SchoolApiScope[],
): Promise<IssuedKey> {
  const secret = KEY_PREFIX + randomBytes(32).toString("base64url");
  const created = await prisma.schoolApiKey.create({
    data: {
      schoolId,
      name,
      scopes,
      hashedKey: hashKey(secret),
      prefix: secret.slice(0, PREFIX_DISPLAY_LEN),
    },
    select: { id: true, prefix: true },
  });
  return { id: created.id, secret, prefix: created.prefix };
}

/** Soft revoke. Rotation = issue the new key, let both work, then revoke the old one. */
export async function revokeSchoolApiKey(schoolId: string, keyId: string): Promise<void> {
  // schoolId in the WHERE clause: another school's key matches zero rows.
  await prisma.schoolApiKey.updateMany({
    where: { id: keyId, schoolId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export type ApiCaller = { schoolId: string; keyId: string; scopes: SchoolApiScope[] };

/**
 * Resolves a presented key to its school and scopes, or null.
 *
 * Looked up BY HASH, so the database never compares the secret itself. The timingSafeEqual is
 * belt-and-braces on the final compare. A revoked key resolves to null, the check is here, once,
 * rather than in every route where it could be forgotten.
 */
export async function authenticateApiKey(rawKey: string | null | undefined): Promise<ApiCaller | null> {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;

  const hashed = hashKey(rawKey);
  const record = await prisma.schoolApiKey.findUnique({
    where: { hashedKey: hashed },
    select: { id: true, schoolId: true, scopes: true, hashedKey: true, revokedAt: true },
  });
  if (!record) return null;

  const a = Buffer.from(record.hashedKey, "utf8");
  const b = Buffer.from(hashed, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (record.revokedAt) return null;

  // Fire-and-forget: a school needs to see which key is stale BEFORE rotating and taking down its
  // own integration. Never allowed to fail a request.
  void prisma.schoolApiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { schoolId: record.schoolId, keyId: record.id, scopes: record.scopes };
}

/** Backwards-compatible helper used by the embed's mint endpoint. */
export async function schoolIdForApiKey(rawKey: string | null | undefined): Promise<string | null> {
  const caller = await authenticateApiKey(rawKey);
  if (!caller) return null;
  // The embed mint endpoint signs a pupil in. That is the highest privilege we grant, and it must
  // not ride along on a key issued for reading reports.
  if (!caller.scopes.includes(SchoolApiScope.EMBED_MINT)) return null;
  return caller.schoolId;
}

export function hasScope(caller: ApiCaller, scope: SchoolApiScope): boolean {
  return caller.scopes.includes(scope);
}

/** Reads the key from `Authorization: Bearer <key>`. */
export function apiKeyFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

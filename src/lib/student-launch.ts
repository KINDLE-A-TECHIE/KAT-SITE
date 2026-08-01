import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { checkEnrollmentLicense } from "./school-license";

/**
 * Teacher-launched pupil sign-in (Option A: lab / kiosk).
 *
 * A teacher who already holds a TEACHER membership over a class mints a 60-second,
 * single-use launch token for one of their pupils. The pupil's own device redeems
 * it into a NORMAL NextAuth session (via the "student-launch" credentials provider),
 * so no pupil ever needs an email or password. This is the answer for schools with
 * no management system of their own to SSO from.
 *
 * Relationship to the embed launch (src/lib/school-embed.ts): same jose/HS256
 * machinery, same EMBED_TOKEN_SECRET, and the same insert-as-lock single-use table
 * (EmbedTokenUse). The AUDIENCE differs deliberately (`kat:student:launch`), so an
 * embed launch token can never be redeemed as a first-party session, nor vice versa.
 */

const ISSUER = "kat";
const LAUNCH_AUD = "kat:student:launch";
const LAUNCH_TTL_SECONDS = 60;

export type StudentLaunchClaims = {
  schoolId: string;
  userId: string;
};

function secret(): Uint8Array {
  const value = process.env.EMBED_TOKEN_SECRET;
  if (!value || value.length < 32) {
    // Fail loudly rather than sign a child's session with a weak or absent key.
    throw new Error("EMBED_TOKEN_SECRET is missing or shorter than 32 characters.");
  }
  return new TextEncoder().encode(value);
}

/** Mints a single-use launch token. The caller MUST already have proved the teacher owns the pupil. */
export async function mintStudentLaunch(claims: StudentLaunchClaims): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + LAUNCH_TTL_SECONDS) * 1000);
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(LAUNCH_AUD)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + LAUNCH_TTL_SECONDS)
    .sign(secret());
  return { token, expiresAt };
}

export type RedeemResult =
  | { ok: true; userId: string; schoolId: string }
  | { ok: false; reason: string };

/**
 * Spends a launch token. Every claim is re-checked against the DB: a signature proves the token is
 * ours, not that the facts inside it are still true. Between minting and redemption a pupil may have
 * been unenrolled or the school's licence may have lapsed, and this token is a key to a child's account.
 */
export async function redeemStudentLaunch(token: string): Promise<RedeemResult> {
  let claims: StudentLaunchClaims & { jti?: string };
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: LAUNCH_AUD,
      algorithms: ["HS256"], // pinned: never let the token choose its own algorithm
    });
    const { schoolId, userId, jti } = payload as Record<string, unknown>;
    if (typeof schoolId !== "string" || typeof userId !== "string") {
      return { ok: false, reason: "Invalid or expired launch link." };
    }
    claims = { schoolId, userId, jti: typeof jti === "string" ? jti : undefined };
  } catch {
    return { ok: false, reason: "Invalid or expired launch link." };
  }

  // A token with no jti cannot be made single-use; refuse it rather than let it replay.
  if (!claims.jti) return { ok: false, reason: "Invalid or expired launch link." };

  // SINGLE USE. The insert IS the lock: jti is the primary key, so a concurrent replay loses on a
  // unique violation. Reuses the embed's spent-token table; the jti namespace is shared UUIDs.
  try {
    await prisma.embedTokenUse.create({
      data: {
        jti: claims.jti,
        schoolId: claims.schoolId,
        expiresAt: new Date(Date.now() + LAUNCH_TTL_SECONDS * 1000),
      },
    });
  } catch {
    return { ok: false, reason: "This launch link has already been used." };
  }

  // The pupil must STILL be an active pupil of this school, right now.
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: claims.userId, schoolId: claims.schoolId, status: "ACTIVE" },
    select: { schoolId: true, schoolClassId: true },
  });
  if (!enrollment) return { ok: false, reason: "This pupil is not enrolled at the school." };

  // Same licence gate as /learn. A launch must not be a way around the thing the school pays for.
  const gate = await checkEnrollmentLicense(enrollment);
  if (!gate.allowed) return { ok: false, reason: gate.reason };

  return { ok: true, userId: claims.userId, schoolId: claims.schoolId };
}

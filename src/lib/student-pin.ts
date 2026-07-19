import "server-only";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { checkEnrollmentLicense } from "./school-license";
import { studentPinLimiter } from "./ratelimit";
import { studentPinLoginSchema } from "./validators";

/**
 * Class-code + PIN sign-in (Option B), for schools with no system to launch from.
 *
 * A pupil enters a teacher-controlled class code, picks their name, and types a 6-digit PIN. A
 * 6-digit PIN is low entropy (10^6), so this file is where the throttling lives: a per-pupil DB
 * lockout (failedAttempts + lockedUntil on SchoolStudentCredential) plus a coarse limiter. Blast
 * radius of a cracked PIN is exactly one child's lessons in one school, no PII, no messaging.
 */

// Unambiguous alphabet: no O/0, I/1, L. A join code is read off a printed card by a child.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const PIN_LEN = 6;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateJoinCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** A 6-digit numeric PIN as a string (leading zeros preserved). */
export function generatePin(): string {
  let out = "";
  for (let i = 0; i < PIN_LEN; i++) out += String(crypto.randomInt(10));
  return out;
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/**
 * Returns the class's join code, generating one if absent. Retries on the unique-constraint race so
 * two admins printing cards at once cannot both claim the same code.
 */
export async function ensureJoinCode(classId: string): Promise<string> {
  const existing = await prisma.schoolClass.findUnique({
    where: { id: classId },
    select: { joinCode: true },
  });
  if (existing?.joinCode) return existing.joinCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateJoinCode();
    try {
      await prisma.schoolClass.update({ where: { id: classId }, data: { joinCode: code } });
      return code;
    } catch {
      // Unique collision (or a concurrent writer won). Re-read; if someone set one, use it.
      const now = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { joinCode: true } });
      if (now?.joinCode) return now.joinCode;
    }
  }
  throw new Error("Could not allocate a class code.");
}

export type PinAuthResult =
  | {
      ok: true;
      user: { id: string; email: string; firstName: string; lastName: string; role: UserRole; organizationId: string | null };
    }
  | { ok: false; reason: string };

/** Deliberately vague so a caller cannot tell "no such pupil" from "wrong PIN". */
const GENERIC = "That PIN is not right. Check your card and try again.";

export async function authorizeStudentPin(credentials: Record<string, unknown> | undefined): Promise<PinAuthResult> {
  const parsed = studentPinLoginSchema.safeParse(credentials);
  if (!parsed.success) return { ok: false, reason: GENERIC };
  const { classCode, pupilRef, pin } = parsed.data;

  // Coarse throttle at the (class, pupil) grain, on top of the DB lockout below.
  if (studentPinLimiter) {
    const { success } = await studentPinLimiter.limit(`${normalizeJoinCode(classCode)}:${pupilRef}`);
    if (!success) return { ok: false, reason: "Too many tries. Please wait a few minutes and try again." };
  }

  // The class code identifies the school; the pupil is looked up WITHIN that class, so a ref from
  // another class (even in the same school) or another school simply is not found.
  const schoolClass = await prisma.schoolClass.findUnique({
    where: { joinCode: normalizeJoinCode(classCode) },
    select: { id: true },
  });
  if (!schoolClass) return { ok: false, reason: GENERIC };

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: pupilRef, schoolClassId: schoolClass.id, status: "ACTIVE" },
    select: {
      id: true,
      schoolId: true,
      schoolClassId: true,
      studentCredential: { select: { pinHash: true, failedAttempts: true, lockedUntil: true } },
      user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, isActive: true } },
    },
  });
  const cred = enrollment?.studentCredential;
  if (!enrollment || !cred || !enrollment.user.isActive) return { ok: false, reason: GENERIC };

  // This provider can only ever sign in a SCHOOL_STUDENT.
  if (enrollment.user.role !== UserRole.SCHOOL_STUDENT) return { ok: false, reason: GENERIC };

  if (cred.lockedUntil && cred.lockedUntil > new Date()) {
    return { ok: false, reason: "This account is locked for a few minutes after too many tries. Ask your teacher if you're stuck." };
  }

  // Licence gate BEFORE the PIN compare, deliberately. If it ran after a successful compare, the
  // "class not active" message would only ever appear for a CORRECT PIN, turning a lapsed-licence
  // class into an oracle that confirms a guessed PIN. Checking first makes the response independent
  // of PIN correctness (and short-circuits brute force entirely while the licence is lapsed).
  const gate = await checkEnrollmentLicense({ schoolId: enrollment.schoolId, schoolClassId: enrollment.schoolClassId });
  if (!gate.allowed) return { ok: false, reason: "Your class is not active right now. Please ask your teacher." };

  const matches = await bcrypt.compare(pin, cred.pinHash);
  if (!matches) {
    const attempts = cred.failedAttempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await prisma.schoolStudentCredential.update({
      where: { enrollmentId: enrollment.id },
      data: {
        failedAttempts: locked ? 0 : attempts,
        lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return { ok: false, reason: GENERIC };
  }

  // Success: clear the counters.
  if (cred.failedAttempts !== 0 || cred.lockedUntil) {
    await prisma.schoolStudentCredential.update({
      where: { enrollmentId: enrollment.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
  }

  return {
    ok: true,
    user: {
      id: enrollment.user.id,
      email: enrollment.user.email,
      firstName: enrollment.user.firstName,
      lastName: enrollment.user.lastName,
      role: enrollment.user.role,
      organizationId: enrollment.user.organizationId,
    },
  };
}

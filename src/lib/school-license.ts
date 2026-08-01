import "server-only";
import { SchoolLicenseStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { isWithinTermWindow, normalizeSession, termNumberForModule } from "./school-term";

/**
 * THE licence gate. One implementation, used by every learner and teacher surface.
 *
 * A school buys seats per TERM within a SESSION. A class is a cohort for a session (it spans that
 * session's term-modules). This gate is SESSION-LEVEL: a class is accessible if the school holds an
 * ACTIVE, in-window licence for that class's session. It resolves and returns that licence (the
 * current term's), so callers can reserve seats against it.
 *
 * (Per-MODULE gating, module N needs term N's licence, is a later, deliberate change. Today, and
 * here, one paid term unlocks the whole course, matching the pre-A2 behaviour.)
 *
 * Enforced in the shared curriculum APIs and the school APIs, never only on a page, because a
 * page-only gate is bypassable by calling the API directly.
 *
 * NOT applied to SCHOOL_ADMIN surfaces: when a licence lapses the admin must still reach billing to
 * fix it. Locking the admin out of the thing that unlocks the school would be a deadlock.
 *
 * B2C is untouched: a null schoolId short-circuits to allowed before any query runs.
 */

type ResolvedLicense = {
  id: string;
  sessionLabel: string;
  termNumber: number;
  seatLimit: number;
  seatsUsed: number;
};

export type LicenseGate =
  | { allowed: true; license: ResolvedLicense }
  | {
      allowed: false;
      code: "NO_CLASS" | "NO_LICENSE" | "INACTIVE" | "EXPIRED_WINDOW" | "OVER_SEATED";
      reason: string;
    };

/**
 * The gate, keyed on the SESSION of the class being accessed.
 *
 * @param schoolId     null/undefined for a B2C enrollment, always allowed.
 * @param sessionLabel the session of the class being accessed. Null means the caller could not
 *                     resolve a class, see the fail-closed note below.
 */
export async function checkClassLicense(
  schoolId: string | null | undefined,
  sessionLabel: string | null | undefined,
): Promise<LicenseGate> {
  if (!schoolId) {
    // B2C, not a school enrollment. No licence applies.
    return {
      allowed: true,
      license: { id: "", sessionLabel: "", termNumber: 0, seatLimit: 0, seatsUsed: 0 },
    };
  }

  // FAIL CLOSED. A school enrollment with no class has no session, so no licence can be resolved.
  // The FKs are RESTRICT, so this is unreachable in normal operation; it could only come from a
  // legacy row or a manual edit. Falling back to "any ACTIVE licence" would hand out access (and a
  // free, untracked seat) on a data anomaly.
  if (!sessionLabel) {
    return {
      allowed: false,
      code: "NO_CLASS",
      reason: "You are not assigned to a class. Ask your school administrator.",
    };
  }

  // Session labels are free text, so match on the normalized form rather than assuming exact
  // equality (a stray case/space difference must not lock a school out of a term it paid for).
  const licenses = await prisma.schoolLicense.findMany({
    where: { schoolId },
    select: {
      id: true,
      sessionLabel: true,
      termNumber: true,
      status: true,
      startsAt: true,
      seatLimit: true,
      seatsUsed: true,
    },
  });

  const wanted = normalizeSession(sessionLabel);
  const forSession = licenses.filter((l) => normalizeSession(l.sessionLabel) === wanted);

  if (forSession.length === 0) {
    return {
      allowed: false,
      code: "NO_LICENSE",
      reason: `Your school has no licence for ${sessionLabel}. Ask your school administrator.`,
    };
  }

  const active = forSession.filter((l) => l.status === SchoolLicenseStatus.ACTIVE);
  if (active.length === 0) {
    return {
      allowed: false,
      code: "INACTIVE",
      reason: `Your school's licence for ${sessionLabel} is not active. Ask your school administrator to renew it.`,
    };
  }

  const now = new Date();
  const usable = active.filter((l) => isWithinTermWindow(l.startsAt, now));
  if (usable.length === 0) {
    return {
      allowed: false,
      code: "EXPIRED_WINDOW",
      reason: `Your school's licence for ${sessionLabel} has expired. Ask your school administrator to renew it.`,
    };
  }

  // The "current" term is the furthest-along licence the school has paid and is within window; with a
  // single term-licence (today's norm) this is simply that one. Seats are reserved against it.
  const license = usable.reduce((a, b) => (b.termNumber > a.termNumber ? b : a));

  if (license.seatsUsed > license.seatLimit) {
    return {
      allowed: false,
      code: "OVER_SEATED",
      reason: `Your school is over its seat limit for ${sessionLabel} (${license.seatsUsed} of ${license.seatLimit}). Ask your school administrator.`,
    };
  }

  return {
    allowed: true,
    license: {
      id: license.id,
      sessionLabel: license.sessionLabel,
      termNumber: license.termNumber,
      seatLimit: license.seatLimit,
      seatsUsed: license.seatsUsed,
    },
  };
}

/**
 * The gate for a learner, resolving the session from their enrollment's class.
 * Used by the shared curriculum APIs, which only hold an enrollment.
 *
 * SESSION-LEVEL: "can this pupil enter at all" (any active, in-window term). Per-MODULE access (which
 * term's content) is checkModuleLicenseForEnrollment below.
 */
export async function checkEnrollmentLicense(enrollment: {
  schoolId: string | null;
  schoolClassId: string | null;
}): Promise<LicenseGate> {
  if (!enrollment.schoolId) {
    return checkClassLicense(null, null); // B2C fast path, no query
  }

  const schoolClass = enrollment.schoolClassId
    ? await prisma.schoolClass.findUnique({
        where: { id: enrollment.schoolClassId },
        select: { sessionLabel: true },
      })
    : null;

  return checkClassLicense(enrollment.schoolId, schoolClass?.sessionLabel ?? null);
}

/**
 * The term numbers a school has UNLOCKED for a session: an ACTIVE licence, within its 15-week window.
 * Module N (termNumberForModule(sortOrder)) is available to pupils iff its number is in this set.
 */
export async function getLicensedTermNumbers(
  schoolId: string,
  sessionLabel: string,
): Promise<Set<number>> {
  const licenses = await prisma.schoolLicense.findMany({
    where: { schoolId },
    select: { sessionLabel: true, termNumber: true, status: true, startsAt: true },
  });
  const wanted = normalizeSession(sessionLabel);
  const now = new Date();
  const licensed = new Set<number>();
  for (const l of licenses) {
    if (
      normalizeSession(l.sessionLabel) === wanted &&
      l.status === SchoolLicenseStatus.ACTIVE &&
      isWithinTermWindow(l.startsAt, now)
    ) {
      licensed.add(l.termNumber);
    }
  }
  return licensed;
}

export type ModuleLicenseGate = { allowed: true } | { allowed: false; reason: string };

/**
 * PER-MODULE content gate. A school learner may open a module's lesson only if that module's term is
 * licensed. B2C (null schoolId) is always allowed, so this is safe to call on the shared curriculum
 * routes for every learner. `moduleSortOrder` is the lesson's module sortOrder (0-based).
 *
 * This is the enforcement behind #6: the learn shell only DISPLAYS the lock, this is what a direct
 * API call hits.
 */
export async function checkModuleLicenseForEnrollment(
  enrollment: { schoolId: string | null; schoolClassId: string | null },
  moduleSortOrder: number,
): Promise<ModuleLicenseGate> {
  if (!enrollment.schoolId) return { allowed: true }; // B2C, no school licence applies

  const schoolClass = enrollment.schoolClassId
    ? await prisma.schoolClass.findUnique({
        where: { id: enrollment.schoolClassId },
        select: { sessionLabel: true },
      })
    : null;
  if (!schoolClass) {
    return { allowed: false, reason: "You are not assigned to a class. Ask your school administrator." };
  }

  const licensed = await getLicensedTermNumbers(enrollment.schoolId, schoolClass.sessionLabel);
  if (!licensed.has(termNumberForModule(moduleSortOrder))) {
    return {
      allowed: false,
      reason: "This term isn't licensed for your school yet. Ask your school administrator.",
    };
  }
  return { allowed: true };
}

/**
 * PER-MODULE PREVIEW gate for school STAFF (teacher/admin). Staff may open a module's lesson if its
 * term is licensed OR the lesson is a free sample. This is what lets a school evaluate a term before
 * buying it. Staff-only: pupils never receive samples of unlicensed terms (their gate is
 * checkModuleLicenseForEnrollment, which does not consider isSample).
 */
export async function checkLessonPreviewLicense(
  schoolId: string,
  sessionLabel: string,
  moduleSortOrder: number,
  isSample: boolean,
): Promise<ModuleLicenseGate> {
  if (isSample) return { allowed: true };
  const licensed = await getLicensedTermNumbers(schoolId, sessionLabel);
  if (licensed.has(termNumberForModule(moduleSortOrder))) return { allowed: true };
  return {
    allowed: false,
    reason: "This term isn't licensed yet. Only its sample lesson is available to preview.",
  };
}

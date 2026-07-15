import "server-only";
import { SchoolLicenseStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * THE licence gate. One implementation, used by every learner and teacher surface.
 *
 * A school buys seats per TERM. Access to a class therefore requires the licence for
 * THAT class's term to be ACTIVE, and the school to be within its seat limit.
 *
 * Enforced in the shared curriculum APIs and the school APIs, never only on a page,
 * because a page-only gate is bypassable by calling the API directly.
 *
 * NOT applied to SCHOOL_ADMIN surfaces: when a licence lapses the admin must still be
 * able to reach billing and fix it. Locking the admin out of the thing that unlocks
 * the school would be a deadlock.
 *
 * B2C is untouched: a null schoolId short-circuits to allowed before any query runs.
 */

export type LicenseGate =
  | { allowed: true; license: { id: string; term: string; seatLimit: number; seatsUsed: number } }
  | { allowed: false; code: "NO_CLASS" | "NO_LICENSE" | "INACTIVE" | "OVER_SEATED"; reason: string };

/** Terms are free text; compare them forgivingly so "2025/2026 T1 " matches "2025/2026 t1". */
export function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * The gate, keyed on the term of the class being accessed.
 *
 * @param schoolId  null/undefined for a B2C enrollment → always allowed.
 * @param classTerm the term of the class being accessed. Null means the caller could
 *                  not resolve a class, see the fail-closed note below.
 */
export async function checkClassLicense(
  schoolId: string | null | undefined,
  classTerm: string | null | undefined,
): Promise<LicenseGate> {
  if (!schoolId) {
    // B2C, not a school enrollment. No licence applies.
    return {
      allowed: true,
      license: { id: "", term: "", seatLimit: 0, seatsUsed: 0 },
    };
  }

  // FAIL CLOSED. A school enrollment with no class has no term, so no licence can be
  // resolved. The FKs are RESTRICT, so this is unreachable in normal operation, it
  // could only come from a legacy row or a manual edit. Falling back to "any ACTIVE
  // licence" would hand out access (and a free, untracked seat) on a data anomaly.
  if (!classTerm) {
    return {
      allowed: false,
      code: "NO_CLASS",
      reason: "You are not assigned to a class. Ask your school administrator.",
    };
  }

  // @@unique([schoolId, term]) guarantees at most one licence per term, but terms are
  // free text, so match on the normalized form rather than assuming exact equality.
  const licenses = await prisma.schoolLicense.findMany({
    where: { schoolId },
    select: { id: true, term: true, status: true, seatLimit: true, seatsUsed: true },
  });

  const wanted = normalizeTerm(classTerm);
  const license = licenses.find((l) => normalizeTerm(l.term) === wanted);

  if (!license) {
    return {
      allowed: false,
      code: "NO_LICENSE",
      reason: `Your school has no licence for ${classTerm}. Ask your school administrator.`,
    };
  }

  if (license.status !== SchoolLicenseStatus.ACTIVE) {
    return {
      allowed: false,
      code: "INACTIVE",
      reason: `Your school's licence for ${classTerm} is not active. Ask your school administrator to renew it.`,
    };
  }

  if (license.seatsUsed > license.seatLimit) {
    return {
      allowed: false,
      code: "OVER_SEATED",
      reason: `Your school is over its seat limit for ${classTerm} (${license.seatsUsed} of ${license.seatLimit}). Ask your school administrator.`,
    };
  }

  return {
    allowed: true,
    license: {
      id: license.id,
      term: license.term,
      seatLimit: license.seatLimit,
      seatsUsed: license.seatsUsed,
    },
  };
}

/**
 * The gate for a learner, resolving the term from their enrollment's class.
 * Used by the shared curriculum APIs, which only hold an enrollment.
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
        select: { term: true },
      })
    : null;

  return checkClassLicense(enrollment.schoolId, schoolClass?.term ?? null);
}

import "server-only";
import { getServerAuthSession } from "./auth";
import { prisma } from "./prisma";
import { ensureSchoolMembership, type SchoolMembershipClaim } from "./rbac";
import type { SchoolRole } from "@prisma/client";

/**
 * Resolve the caller's active school from the session.
 *
 * Per the school product spec, active-school resolution comes from the session
 * plus (in middleware) the subdomain/slug. This is the session half: it returns
 * the membership the session marks active (`activeSchoolId`), or a specific
 * school when `schoolId` is passed and the user is a member of it. Returns null
 * when the user is not signed in or holds no matching membership.
 *
 * The host→school subdomain rewrite lives in `src/middleware.ts` (the (school)
 * route group); when that sets the active school it should flow through here.
 */
export async function getActiveSchool(
  schoolId?: string,
): Promise<SchoolMembershipClaim | null> {
  const session = await getServerAuthSession();
  const memberships = session?.user?.schoolMemberships;
  if (!memberships || memberships.length === 0) {
    return null;
  }

  const targetId = schoolId ?? session?.user?.activeSchoolId ?? null;
  if (!targetId) {
    return null;
  }

  return memberships.find((m) => m.schoolId === targetId) ?? null;
}

/**
 * Server-side convenience for (school) pages/routes: resolve the active school
 * and assert the caller has an allowed role in it. Throws "Unauthorized" /
 * "Forbidden" like `ensureSchoolMembership`, so callers can 403 or redirect.
 */
export async function requireActiveSchool(
  allowedRoles: SchoolRole[],
  schoolId?: string,
): Promise<SchoolMembershipClaim> {
  const session = await getServerAuthSession();

  // Distinguish "not signed in" (401) from "signed in but not allowed" (403).
  // Checked first: an anonymous caller has no activeSchoolId, so without this the
  // no-target branch below would misreport a missing session as Forbidden.
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const targetId = schoolId ?? session.user.activeSchoolId ?? null;
  if (!targetId) {
    throw new Error("Forbidden");
  }
  return ensureSchoolMembership(session.user, targetId, allowedRoles);
}

/**
 * Tenant guard for a STUDENT inside a school.
 *
 * School students are NOT SchoolMembership rows. SchoolRole is only
 * SCHOOL_ADMIN | TEACHER. A school student is a global STUDENT whose Enrollment
 * carries the schoolId (null schoolId = B2C). So membership-based guards cannot
 * protect /learn; this checks enrollment instead.
 *
 * DB-backed (not session-derived), so a student removed from a school loses
 * access immediately. Throws "Unauthorized" (no session) / "Forbidden".
 */
export async function ensureSchoolStudent(schoolId?: string): Promise<{ schoolId: string }> {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      schoolId: schoolId ? schoolId : { not: null },
    },
    select: { schoolId: true },
  });

  if (!enrollment?.schoolId) {
    throw new Error("Forbidden");
  }

  return { schoolId: enrollment.schoolId };
}

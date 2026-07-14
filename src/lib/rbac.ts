import type { Session } from "next-auth";
import { UserRole, SchoolRole } from "@prisma/client";
import { prisma } from "./prisma";
import { ADMIN_ROLES, SCHOOL_ROLES } from "./roles";

export type SessionUser = Session["user"];

/** A user's membership in one school (school-scoped role, NOT global User.role). */
export type SchoolMembershipClaim = { schoolId: string; role: SchoolRole };

export function hasAnyRole(role: UserRole, roles: UserRole[]) {
  return roles.includes(role);
}

export function ensureAuthenticated(session: Session | null): SessionUser {
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export function ensureRole(user: SessionUser, roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
}

async function isMentoredBy(fellowId: string, studentId: string) {
  const mentorship = await prisma.mentorship.findUnique({
    where: { fellowId_studentId: { fellowId, studentId } },
    select: { active: true },
  });
  return Boolean(mentorship?.active);
}

/**
 * School-scoped authorization guard, the B2B analogue of `ensureRole`.
 *
 * Confirms the session user holds a membership in `schoolId` whose school-scoped role is in
 * `allowedRoles`. Throws "Unauthorized" (no session) or "Forbidden" (no membership / wrong school /
 * wrong role), mirroring ensureRole so callers can catch and either 403 or redirect.
 *
 * It NEVER reads User.role. School authority lives in SchoolMembership.
 */
export function ensureSchoolMembership(
  user: SessionUser | null | undefined,
  schoolId: string,
  allowedRoles: SchoolRole[],
): SchoolMembershipClaim {
  if (!user?.id) {
    throw new Error("Unauthorized");
  }
  const membership = user.schoolMemberships?.find((m) => m.schoolId === schoolId);
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error("Forbidden");
  }
  return membership;
}

/**
 * Tenant-isolation gate: assert a fetched resource belongs to a school the caller may access,
 * BEFORE any read/write on it. Derive the resource's schoolId from the DB record (never from the
 * request), then call this. A missing or foreign schoolId is privilege escalation, so it throws.
 */
export function assertResourceInSchool(
  user: SessionUser | null | undefined,
  resource: { schoolId: string },
  allowedRoles: SchoolRole[],
): void {
  ensureSchoolMembership(user, resource.schoolId, allowedRoles);
}

export async function canMessageUser(senderId: string, recipientId: string) {
  if (senderId === recipientId) {
    return true;
  }

  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({
      where: { id: senderId },
      select: { id: true, role: true, organizationId: true },
    }),
    prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, role: true, organizationId: true },
    }),
  ]);

  if (!sender || !recipient) {
    return false;
  }

  /*
   * Messaging is a B2C feature and does not cross the school boundary, in EITHER direction, and not
   * even for a SUPER_ADMIN (whose blanket `true` below would otherwise let a KAT employee DM a
   * school's child directly).
   *
   * A school's pupils are reachable by their own teachers, through the school product. Nobody on the
   * consumer side has standing over them.
   */
  if (SCHOOL_ROLES.includes(sender.role) || SCHOOL_ROLES.includes(recipient.role)) {
    return false;
  }

  if (sender.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  if (ADMIN_ROLES.includes(sender.role)) {
    return true;
  }

  switch (sender.role) {
    case UserRole.PARENT:
      return ADMIN_ROLES.includes(recipient.role);

    case UserRole.STUDENT:
      if (
        recipient.role === UserRole.INSTRUCTOR ||
        ADMIN_ROLES.includes(recipient.role)
      ) {
        return true;
      }
      if (recipient.role === UserRole.FELLOW) {
        return isMentoredBy(recipient.id, sender.id);
      }
      return false;

    case UserRole.FELLOW:
      if (
        recipient.role === UserRole.INSTRUCTOR ||
        ADMIN_ROLES.includes(recipient.role)
      ) {
        return true;
      }
      if (recipient.role === UserRole.STUDENT) {
        return isMentoredBy(sender.id, recipient.id);
      }
      return false;

    case UserRole.INSTRUCTOR:
      return (
        recipient.role === UserRole.STUDENT ||
        recipient.role === UserRole.FELLOW ||
        ADMIN_ROLES.includes(recipient.role)
      );

    default:
      return false;
  }
}

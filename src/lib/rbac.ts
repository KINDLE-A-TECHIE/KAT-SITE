import type { Session } from "next-auth";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { ADMIN_ROLES } from "./roles";

export type SessionUser = Session["user"];

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

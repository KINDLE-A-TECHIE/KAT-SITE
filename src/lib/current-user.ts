import { UserRole } from "@prisma/client";
import { getServerAuthSession } from "./auth";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      organizationId: true,
    },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export function canManagePlatform(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

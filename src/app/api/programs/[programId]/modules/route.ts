import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ programId: string }> }

const MANAGER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!MANAGER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { programId } = await params;

  const activeVersion = await prisma.curriculumVersion.findFirst({
    where: {
      isActive: true,
      curriculum: { programId },
    },
    select: {
      modules: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true },
      },
    },
  });

  return ok({ modules: activeVersion?.modules ?? [] });
}

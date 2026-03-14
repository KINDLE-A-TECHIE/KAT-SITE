import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ programId: string }> }

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const isAdmin =
    session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  if (!isAdmin) return fail("Forbidden", 403);

  const { programId } = await params;

  const curriculum = await prisma.curriculum.findUnique({
    where: { programId },
    select: { id: true },
  });
  if (!curriculum) return ok({ versions: [] });

  const versions = await prisma.curriculumVersion.findMany({
    where: { curriculumId: curriculum.id },
    orderBy: { versionNumber: "desc" },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  return ok({ versions });
}
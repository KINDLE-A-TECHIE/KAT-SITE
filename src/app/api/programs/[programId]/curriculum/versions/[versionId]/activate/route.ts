import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ programId: string; versionId: string }> }

export async function POST(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { versionId } = await params;

  const version = await prisma.curriculumVersion.findUnique({
    where: { id: versionId },
    select: { id: true, curriculumId: true },
  });
  if (!version) return fail("Version not found.", 404);

  // Transaction: deactivate all siblings, activate this one
  const [, activated] = await prisma.$transaction([
    prisma.curriculumVersion.updateMany({
      where: { curriculumId: version.curriculumId, id: { not: versionId } },
      data: { isActive: false },
    }),
    prisma.curriculumVersion.update({
      where: { id: versionId },
      data: { isActive: true, publishedAt: new Date() },
    }),
  ]);

  return ok({ version: activated });
}
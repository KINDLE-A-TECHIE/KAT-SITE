import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

interface Params { params: Promise<{ assessmentId: string; resourceId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { assessmentId, resourceId } = await params;

  const resource = await prisma.assessmentResource.findUnique({
    where: { id: resourceId },
    select: {
      id: true,
      assessmentId: true,
      uploaderId: true,
      storageKey: true,
      assessment: { select: { program: { select: { organizationId: true } } } },
    },
  });
  if (!resource || resource.assessmentId !== assessmentId) return fail("Resource not found.", 404);

  const role = session.user.role as UserRole;
  const isSuperAdmin = role === UserRole.SUPER_ADMIN;
  const isOwner = resource.uploaderId === session.user.id;
  const isOrgAdmin =
    (role === UserRole.ADMIN || role === UserRole.INSTRUCTOR) &&
    resource.assessment.program.organizationId === session.user.organizationId;

  if (!isSuperAdmin && !isOwner && !isOrgAdmin) return fail("Forbidden", 403);

  await deleteR2Object(resource.storageKey).catch(() => {});
  await prisma.assessmentResource.delete({ where: { id: resourceId } });

  return ok({ message: "Resource deleted." });
}

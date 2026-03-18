import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";

interface Params { params: Promise<{ projectId: string; fileId: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId, fileId } = await params;
  const file = await prisma.projectFile.findUnique({
    where: { id: fileId },
    include: { project: { select: { studentId: true, status: true } } },
  });

  if (!file || file.projectId !== projectId) return fail("File not found.", 404);

  const isAdmin = session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  if (file.project.studentId !== session.user.id && !isAdmin) return fail("Forbidden", 403);
  if (file.project.status !== "DRAFT" && file.project.status !== "NEEDS_WORK" && !isAdmin) {
    return fail("Cannot delete files from a submitted project.", 400);
  }

  await deleteR2Object(file.storageKey).catch(() => {});
  await prisma.projectFile.delete({ where: { id: fileId } });

  return ok({ message: "File deleted." });
}

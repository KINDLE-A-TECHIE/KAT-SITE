import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ projectId: string }> }

// Public endpoint — no auth required. Only returns APPROVED + PUBLIC projects.
export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      student: { select: { firstName: true, lastName: true } },
      program: { select: { id: true, name: true } },
      files: { select: { id: true, name: true, mimeType: true, url: true } },
      feedback: {
        where: { author: { role: { in: ["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"] } } },
        include: { author: { select: { firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { files: true } },
    },
  });

  if (!project) return fail("Project not found.", 404);
  if (project.status !== "APPROVED") {
    return fail("This project is not publicly available.", 404);
  }

  return ok({ project });
}

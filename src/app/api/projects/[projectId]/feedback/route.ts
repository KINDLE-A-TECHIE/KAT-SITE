import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ projectId: string }> }

const schema = z.object({ body: z.string().min(1).max(2000) });

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role;
  const canReview = role === UserRole.INSTRUCTOR || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  if (!canReview) return fail("Only instructors and admins can leave feedback.", 403);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, status: true } });
  if (!project) return fail("Project not found.", 404);
  if (project.status === "DRAFT") return fail("Cannot review a draft project.", 400);

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const feedback = await prisma.projectFeedback.create({
    data: { projectId, authorId: session.user.id, body: parsed.data.body },
    include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  return ok({ feedback }, 201);
}

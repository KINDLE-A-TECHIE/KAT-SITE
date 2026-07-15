import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ projectId: string; feedbackId: string }> }

const schema = z.object({ body: z.string().min(1).max(2000) });

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId, feedbackId } = await params;
  const feedback = await prisma.projectFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, projectId: true, authorId: true },
  });
  if (!feedback || feedback.projectId !== projectId) return fail("Feedback not found.", 404);
  if (feedback.authorId !== session.user.id) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const updated = await prisma.projectFeedback.update({
    where: { id: feedbackId },
    data: { body: parsed.data.body },
    include: { author: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  return ok({ feedback: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { projectId, feedbackId } = await params;
  const feedback = await prisma.projectFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, projectId: true, authorId: true },
  });
  if (!feedback || feedback.projectId !== projectId) return fail("Feedback not found.", 404);

  const isAdmin =
    session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  if (feedback.authorId !== session.user.id && !isAdmin) return fail("Forbidden", 403);

  await prisma.projectFeedback.delete({ where: { id: feedbackId } });
  return ok({ message: "Feedback deleted." });
}

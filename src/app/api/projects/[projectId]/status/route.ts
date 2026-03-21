import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildProjectStatusEmail } from "@/lib/email";
import { projectStatusLimiter, rateLimitResponse } from "@/lib/ratelimit";

interface Params { params: Promise<{ projectId: string }> }

const schema = z.object({
  status: z.enum(["APPROVED", "NEEDS_WORK", "REJECTED"]),
});

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role;
  const canReview = role === UserRole.INSTRUCTOR || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
  if (!canReview) return fail("Forbidden", 403);

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      status: true,
      student: { select: { id: true, firstName: true, email: true } },
      feedback: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
    },
  });
  if (!project) return fail("Project not found.", 404);
  if (project.status === "DRAFT") return fail("Cannot review a draft project.", 400);

  if (projectStatusLimiter) {
    const { success, reset } = await projectStatusLimiter.limit(session.user.id);
    if (!success) return rateLimitResponse(reset);
  }

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input.", 400, parsed.error.flatten());

  const [updated] = await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { status: parsed.data.status },
      select: { id: true, status: true, studentId: true },
    }),
    prisma.projectReview.create({
      data: { projectId, reviewerId: session.user.id, status: parsed.data.status },
    }),
  ]);

  // Fire-and-forget email — don't let email failure block the response
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const projectUrl = `${baseUrl}/dashboard/projects`;
  const latestFeedback = project.feedback[0]?.body;

  void sendEmail({
    to: project.student.email,
    subject:
      parsed.data.status === "APPROVED"
        ? `Your project "${project.title}" has been approved!`
        : parsed.data.status === "NEEDS_WORK"
        ? `Revision requested for "${project.title}"`
        : `Update on your project "${project.title}"`,
    ...buildProjectStatusEmail({
      firstName: project.student.firstName,
      projectTitle: project.title,
      status: parsed.data.status,
      feedback: latestFeedback,
      projectUrl,
    }),
  });

  return ok({ project: updated });
}

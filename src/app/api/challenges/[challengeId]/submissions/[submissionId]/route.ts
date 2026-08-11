import { z } from "zod";
import { NotificationType, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { capabilityDenied } from "@/lib/capabilities";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ challengeId: string; submissionId: string }> }

const MANAGER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

const gradeSchema = z.object({
  score: z.number().int().min(0),
  feedback: z.string().max(2000).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!MANAGER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (capabilityDenied(session.user, "challenges")) return fail("Forbidden", 403);

  const { submissionId } = await params;

  const submission = await prisma.challengeSubmission.findUnique({
    where: { id: submissionId },
    include: {
      challenge: {
        select: {
          id: true,
          title: true,
          points: true,
          organizationId: true,
        },
      },
    },
  });

  if (!submission) return fail("Submission not found.", 404);

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    submission.challenge.organizationId !== session.user.organizationId
  ) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = gradeSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid grading payload.", 400, parsed.error.flatten());

  // Cap score at challenge's max points
  const cappedScore = Math.min(parsed.data.score, submission.challenge.points);

  const updated = await prisma.challengeSubmission.update({
    where: { id: submissionId },
    data: {
      score: cappedScore,
      feedback: parsed.data.feedback ?? null,
      gradedById: session.user.id,
      gradedAt: new Date(),
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      gradedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Notify the student their submission has been graded
  await prisma.notification.create({
    data: {
      recipientId: submission.studentId,
      creatorId: session.user.id,
      type: NotificationType.SUCCESS,
      title: "Challenge graded!",
      body: JSON.stringify({
        text: `Your submission for "${submission.challenge.title}" has been scored: ${cappedScore}/${submission.challenge.points}. Check the leaderboard!`,
        targetPath: "/dashboard/challenges",
      }),
    },
  });

  return ok({ submission: updated });
}

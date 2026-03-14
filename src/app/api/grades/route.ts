import { AssessmentVerificationStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LEARNER_ROLES: string[] = [UserRole.STUDENT, UserRole.FELLOW];

async function getEnrollmentsForUser(userId: string) {
  return prisma.enrollment.findMany({
    where: { userId },
    orderBy: { enrolledAt: "desc" },
    include: {
      cohort: { select: { id: true, name: true, startsAt: true, endsAt: true } },
      program: {
        select: {
          id: true,
          name: true,
          assessments: {
            where: { published: true, verificationStatus: AssessmentVerificationStatus.APPROVED },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              title: true,
              type: true,
              passScore: true,
              totalPoints: true,
              dueDate: true,
              submissions: {
                where: { studentId: userId },
                select: {
                  id: true,
                  status: true,
                  totalScore: true,
                  autoScore: true,
                  manualScore: true,
                  submittedAt: true,
                  gradedAt: true,
                  feedback: true,
                  // Include per-answer feedback with grader info
                  answers: {
                    select: {
                      id: true,
                      feedback: true,
                      manualScore: true,
                      autoScore: true,
                      isCorrect: true,
                      question: { select: { id: true, prompt: true, type: true } },
                      gradedBy: {
                        select: { id: true, firstName: true, lastName: true, role: true },
                      },
                    },
                    where: { feedback: { not: null } }, // only answers that have feedback
                  },
                },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  const wardId = url.searchParams.get("wardId");

  // PARENT viewing a ward's grades
  if (session.user.role === UserRole.PARENT) {
    if (!wardId) return fail("wardId is required for parents.", 400);

    // Verify this parent is linked to this child
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_childId: { parentId: session.user.id, childId: wardId } },
      select: { childId: true },
    });
    if (!link) return fail("Forbidden", 403);

    const enrollments = await getEnrollmentsForUser(wardId);
    return ok({ enrollments });
  }

  // STUDENT / FELLOW viewing their own grades
  if (!LEARNER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  const enrollments = await getEnrollmentsForUser(session.user.id);
  return ok({ enrollments });
}

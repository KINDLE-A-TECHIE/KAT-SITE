import { AssessmentVerificationStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
const LEARNER_ROLES = [UserRole.STUDENT, UserRole.FELLOW];

async function loadTranscript(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      createdAt: true,
      enrollments: {
        orderBy: { enrolledAt: "asc" },
        select: {
          id: true,
          status: true,
          enrolledAt: true,
          cohort: { select: { id: true, name: true, startsAt: true, endsAt: true } },
          program: {
            select: {
              id: true,
              name: true,
              assessments: {
                where: {
                  published: true,
                  verificationStatus: AssessmentVerificationStatus.APPROVED,
                },
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
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return user;
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  const wardId = url.searchParams.get("wardId");
  const targetUserId = url.searchParams.get("userId");

  // PARENT viewing a ward's transcript
  if (session.user.role === UserRole.PARENT) {
    if (!wardId) return fail("wardId is required for parents.", 400);
    const link = await prisma.parentStudent.findUnique({
      where: { parentId_childId: { parentId: session.user.id, childId: wardId } },
      select: { childId: true },
    });
    if (!link) return fail("Forbidden", 403);
    const transcript = await loadTranscript(wardId);
    return ok({ transcript });
  }

  // ADMIN / SUPER_ADMIN viewing any user's transcript
  if (ADMIN_ROLES.includes(session.user.role as UserRole)) {
    const resolvedId = targetUserId ?? session.user.id;
    const transcript = await loadTranscript(resolvedId);
    return ok({ transcript });
  }

  // STUDENT / FELLOW viewing own transcript
  if (!LEARNER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  const transcript = await loadTranscript(session.user.id);
  return ok({ transcript });
}

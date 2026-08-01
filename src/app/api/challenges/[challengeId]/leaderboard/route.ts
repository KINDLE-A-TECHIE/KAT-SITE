import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ challengeId: string }> }

const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { challengeId } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      published: true,
      programId: true,
      moduleId: true,
      organizationId: true,
      points: true,
    },
  });
  if (!challenge) return fail("Challenge not found.", 404);

  const isLearner = LEARNER_ROLES.includes(session.user.role as UserRole);

  if (isLearner) {
    // Must be published and the student must be enrolled
    if (!challenge.published) return fail("Challenge not found.", 404);

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: session.user.id, programId: challenge.programId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!enrollment) return fail("You are not enrolled in this program.", 403);

    if (challenge.moduleId) {
      const gateStatus = await prisma.moduleGateStatus.findFirst({
        where: { userId: session.user.id, moduleId: challenge.moduleId },
        select: { id: true },
      });
      if (!gateStatus) return fail("You have not reached this module.", 403);
    }
  } else {
    // Managers must belong to same org (or be super admin)
    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      challenge.organizationId !== session.user.organizationId
    ) return fail("Forbidden", 403);
  }

  // Only submissions with a score are ranked. Cap the payload to the top N; totalSubmissions
  // below still reports the true count for display.
  const LEADERBOARD_LIMIT = 100;
  const scoredSubmissions = await prisma.challengeSubmission.findMany({
    where: { challengeId, score: { not: null } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
    take: LEADERBOARD_LIMIT,
  });

  const leaderboard = scoredSubmissions.map((sub, index) => ({
    rank: index + 1,
    studentId: sub.studentId,
    studentName: `${sub.student.firstName} ${sub.student.lastName}`,
    score: sub.score!,
    maxPoints: challenge.points,
    submittedAt: sub.submittedAt,
    isCurrentUser: sub.studentId === session.user.id,
  }));

  // Count total submissions (including ungraded) for display
  const totalSubmissions = await prisma.challengeSubmission.count({ where: { challengeId } });

  // The current user's own rank, even when they fall outside the visible top-N. Rank their best
  // scored submission among all scored submissions (this board ranks submissions, not students).
  let currentUserEntry = leaderboard.find((e) => e.isCurrentUser) ?? null;
  if (isLearner && !currentUserEntry) {
    const mine = await prisma.challengeSubmission.findFirst({
      where: { challengeId, studentId: session.user.id, score: { not: null } },
      orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
      select: { score: true, submittedAt: true, student: { select: { firstName: true, lastName: true } } },
    });
    if (mine?.score != null) {
      const better = await prisma.challengeSubmission.count({
        where: {
          challengeId,
          score: { not: null },
          OR: [
            { score: { gt: mine.score } },
            { score: mine.score, submittedAt: { lt: mine.submittedAt } },
          ],
        },
      });
      currentUserEntry = {
        rank: better + 1,
        studentId: session.user.id,
        studentName: `${mine.student.firstName} ${mine.student.lastName}`,
        score: mine.score,
        maxPoints: challenge.points,
        submittedAt: mine.submittedAt,
        isCurrentUser: true,
      };
    }
  }

  return ok({ leaderboard, totalSubmissions, maxPoints: challenge.points, currentUserEntry });
}

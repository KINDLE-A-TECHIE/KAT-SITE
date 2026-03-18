import { AssessmentVerificationStatus, AttemptStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Called after a submission is fully graded.
 * If the student has now passed every published+approved assessment in the module,
 * award the module badge (idempotent — does nothing if already earned).
 */
export async function tryAwardModuleBadge(studentId: string, assessmentId: string): Promise<string | null> {
  // Get the assessment's moduleId
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { moduleId: true },
  });
  if (!assessment?.moduleId) return null;

  const { moduleId } = assessment;

  // Find the badge for this module
  const badge = await prisma.badge.findUnique({
    where: { moduleId },
    select: { id: true },
  });
  if (!badge) return null;

  // Already earned?
  const alreadyEarned = await prisma.userBadge.findUnique({
    where: { userId_badgeId: { userId: studentId, badgeId: badge.id } },
  });
  if (alreadyEarned) return null;

  // Get all published + approved assessments in this module
  const moduleAssessments = await prisma.assessment.findMany({
    where: {
      moduleId,
      published: true,
      verificationStatus: AssessmentVerificationStatus.APPROVED,
    },
    select: { id: true, passScore: true },
  });
  if (moduleAssessments.length === 0) return null;

  // Check that the student has a passing GRADED submission for each one
  const passedIds = new Set(
    (
      await prisma.assessmentSubmission.findMany({
        where: {
          studentId,
          assessmentId: { in: moduleAssessments.map(a => a.id) },
          status: AttemptStatus.GRADED,
        },
        select: { assessmentId: true, totalScore: true, assessment: { select: { passScore: true } } },
      })
    )
      .filter(s => s.totalScore >= s.assessment.passScore)
      .map(s => s.assessmentId)
  );

  const allPassed = moduleAssessments.every(a => passedIds.has(a.id));
  if (!allPassed) return null;

  // Award badge
  await prisma.userBadge.create({
    data: { userId: studentId, badgeId: badge.id },
  });

  return badge.id;
}

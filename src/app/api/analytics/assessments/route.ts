import { AttemptStatus, AssessmentVerificationStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function daysSince(value: Date) {
  return Math.floor((Date.now() - value.getTime()) / (24 * 60 * 60 * 1000));
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (!session.user.organizationId) return fail("No organization", 400);

  const assessments = await prisma.assessment.findMany({
    where: {
      program: { organizationId: session.user.organizationId },
      published: true,
      verificationStatus: AssessmentVerificationStatus.APPROVED,
    },
    select: {
      id: true,
      title: true,
      type: true,
      passScore: true,
      totalPoints: true,
      dueDate: true,
      createdAt: true,
      program: { select: { id: true, name: true } },
      submissions: {
        select: {
          totalScore: true,
          status: true,
          submittedAt: true,
          gradedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const assessmentStats = assessments.map((assessment) => {
    const submissions = assessment.submissions;
    const totalSubmissions = submissions.length;

    const gradedSubmissions = submissions.filter((s) => s.gradedAt !== null && s.totalScore !== null);
    const pendingGrading = submissions.filter(
      (s) => s.status === AttemptStatus.SUBMITTED && s.gradedAt === null,
    ).length;

    // Average score (as % of totalPoints if available, else raw)
    const avgScore =
      gradedSubmissions.length === 0
        ? null
        : roundToOneDecimal(
            gradedSubmissions.reduce((sum, s) => sum + Number(s.totalScore), 0) /
              gradedSubmissions.length,
          );

    // Pass rate
    let passCount = 0;
    let passableCount = 0;
    if (assessment.passScore !== null) {
      const passScore = Number(assessment.passScore);
      for (const sub of submissions) {
        if (sub.totalScore === null) continue;
        passableCount += 1;
        if (Number(sub.totalScore) >= passScore) passCount += 1;
      }
    }
    const passRate =
      passableCount === 0 ? null : roundToOneDecimal((passCount / passableCount) * 100);

    // Grade distribution (A >=90%, B >=75%, C >=60%, D >=40%, F <40%)
    // Based on percentage of totalPoints
    const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    if (assessment.totalPoints && Number(assessment.totalPoints) > 0) {
      const maxPts = Number(assessment.totalPoints);
      for (const sub of gradedSubmissions) {
        const pct = (Number(sub.totalScore) / maxPts) * 100;
        if (pct >= 90) distribution.A += 1;
        else if (pct >= 75) distribution.B += 1;
        else if (pct >= 60) distribution.C += 1;
        else if (pct >= 40) distribution.D += 1;
        else distribution.F += 1;
      }
    }

    // Grading turnaround: avg days from submittedAt to gradedAt
    const turnaroundDays =
      gradedSubmissions.length === 0
        ? null
        : roundToOneDecimal(
            gradedSubmissions.reduce((sum, s) => {
              return sum + daysSince(s.submittedAt) - daysSince(s.gradedAt!);
            }, 0) / gradedSubmissions.length,
          );

    // Overdue: past due date, any unsubmitted slots? We can only measure via enrolled users,
    // so here we report whether the assessment is past due.
    const isOverdue = assessment.dueDate ? assessment.dueDate < new Date() : false;

    return {
      assessmentId: assessment.id,
      title: assessment.title,
      type: assessment.type,
      programId: assessment.program.id,
      programName: assessment.program.name,
      totalSubmissions,
      pendingGrading,
      passRate,
      avgScore,
      avgScoreOutOf: assessment.totalPoints ? Number(assessment.totalPoints) : null,
      distribution,
      turnaroundDays,
      dueDate: assessment.dueDate,
      isOverdue,
    };
  });

  const totalPendingGrading = assessmentStats.reduce((sum, a) => sum + a.pendingGrading, 0);

  return ok({
    assessments: assessmentStats,
    totalPendingGrading,
  });
}

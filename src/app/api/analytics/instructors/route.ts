import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ADMIN_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (!session.user.organizationId) return fail("No organization context.", 400);

  const instructors = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId,
      role: { in: [UserRole.INSTRUCTOR, UserRole.FELLOW] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      _count: { select: { assessmentsCreated: true } },
      manualGrades: {
        select: {
          id: true,
          feedback: true,
          createdAt: true,
          submissionId: true,
          submission: {
            select: {
              submittedAt: true,
              totalScore: true,
              assessment: { select: { passScore: true, totalPoints: true } },
            },
          },
        },
      },
    },
  });

  const scorecards = instructors.map((instructor) => {
    const grades = instructor.manualGrades;

    // Group grades by submissionId
    const bySubmission = new Map<
      string,
      { maxGradedAt: Date; submittedAt: Date; totalScore: number; passScore: number | null }
    >();
    for (const grade of grades) {
      const existing = bySubmission.get(grade.submissionId);
      const gradeTime = grade.createdAt;
      if (!existing || gradeTime > existing.maxGradedAt) {
        bySubmission.set(grade.submissionId, {
          maxGradedAt: gradeTime,
          submittedAt: grade.submission.submittedAt,
          totalScore: grade.submission.totalScore ?? 0,
          passScore: grade.submission.assessment.passScore,
        });
      }
    }

    const submissionsGraded = bySubmission.size;

    // Avg grading turnaround in hours
    let avgTurnaroundHours: number | null = null;
    if (submissionsGraded > 0) {
      const totalHours = Array.from(bySubmission.values()).reduce((sum, s) => {
        const diffMs = s.maxGradedAt.getTime() - s.submittedAt.getTime();
        return sum + Math.max(0, diffMs) / (1000 * 60 * 60);
      }, 0);
      avgTurnaroundHours = round1(totalHours / submissionsGraded);
    }

    // Avg feedback length (chars) across all grade entries with feedback
    const feedbackEntries = grades.filter((g) => g.feedback && g.feedback.trim().length > 0);
    const avgFeedbackLength =
      feedbackEntries.length === 0
        ? null
        : Math.round(
            feedbackEntries.reduce((sum, g) => sum + (g.feedback?.length ?? 0), 0) /
              feedbackEntries.length,
          );

    // Student pass rate — unique submissions with known passScore
    const passableSubmissions = Array.from(bySubmission.values()).filter(
      (s) => s.passScore !== null,
    );
    const studentPassRate =
      passableSubmissions.length === 0
        ? null
        : round1(
            (passableSubmissions.filter((s) => s.totalScore >= (s.passScore ?? 0)).length /
              passableSubmissions.length) *
              100,
          );

    return {
      instructorId: instructor.id,
      name: `${instructor.firstName} ${instructor.lastName}`,
      role: instructor.role,
      assessmentsCreated: instructor._count.assessmentsCreated,
      submissionsGraded,
      avgTurnaroundHours,
      avgFeedbackLength,
      studentPassRate,
    };
  });

  // Sort by submissionsGraded desc, then name
  scorecards.sort(
    (a, b) => b.submissionsGraded - a.submissionsGraded || a.name.localeCompare(b.name),
  );

  return ok({ scorecards });
}

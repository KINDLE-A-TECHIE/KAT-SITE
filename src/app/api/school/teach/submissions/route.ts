import { AttemptStatus, QuestionType, SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense } from "@/lib/school-license";
import { schoolGradeSubmissionSchema } from "@/lib/validators";
import { teacherDisplayName } from "@/lib/school-teacher-history";
import { trySchoolAssessmentGate } from "@/lib/school-grading";
import { captureError } from "@/lib/sentry";

/**
 * A teacher grading the human-marked parts of their class's assessment submissions.
 *
 * KAT auto-marks the objective and CODE questions; this is where the teacher marks the OPEN_ENDED
 * (theory) and RUBRIC (observed practical) answers. Scoped to a class the teacher owns and to that
 * class's assessment. Pupil names travel in the response body (the teacher needs them), never in a URL.
 *
 * GUARD: the submission's pupil must be enrolled in a class THIS teacher owns, verified from the class's
 * teacherId, so a teacher cannot grade another class's work by guessing a submission id.
 */

async function loadOwnClass(schoolId: string, teacherId: string, classId: string) {
  return prisma.schoolClass.findFirst({
    where: { id: classId, schoolId, teacherId },
    select: { id: true, sessionLabel: true },
  });
}

export async function GET(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const assessmentId = url.searchParams.get("assessmentId");
  if (!classId || !assessmentId) return fail("classId and assessmentId are required.", 400);

  try {
    const cls = await loadOwnClass(schoolId, session!.user.id, classId);
    if (!cls) return fail("Class not found.", 404);
    const gate = await checkClassLicense(schoolId, cls.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);

    // The assessment must be scheduled to this class.
    const scheduled = await prisma.schoolClassAssessment.findUnique({
      where: { schoolClassId_assessmentId: { schoolClassId: classId, assessmentId } },
      select: { assessment: { select: { title: true } } },
    });
    if (!scheduled) return fail("That assessment is not scheduled for this class.", 404);

    const submissions = await prisma.assessmentSubmission.findMany({
      where: { assessmentId, enrollment: { schoolClassId: classId } },
      select: {
        id: true,
        status: true,
        autoScore: true,
        totalScore: true,
        student: { select: { id: true, firstName: true, lastName: true } },
        answers: {
          select: {
            id: true,
            responseText: true,
            manualScore: true,
            autoScore: true,
            question: {
              select: {
                id: true,
                prompt: true,
                type: true,
                points: true,
                rubricCriteria: { orderBy: { sortOrder: "asc" }, select: { label: true, description: true, maxPoints: true } },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    });

    const items = submissions.map((s) => ({
      submissionId: s.id,
      userId: s.student.id, // opaque; the name is for the teacher's own screen
      pupilName: `${s.student.firstName} ${s.student.lastName}`.trim(),
      status: s.status,
      autoScore: s.autoScore,
      totalScore: s.totalScore,
      // Answers the teacher marks by hand; auto answers are summarized by autoScore above.
      manualAnswers: s.answers
        .filter((a) => a.question.type === QuestionType.OPEN_ENDED || a.question.type === QuestionType.RUBRIC)
        .map((a) => ({
          answerId: a.id,
          questionId: a.question.id,
          prompt: a.question.prompt,
          type: a.question.type,
          maxPoints: a.question.points,
          responseText: a.responseText,
          manualScore: a.manualScore,
          rubric: a.question.type === QuestionType.RUBRIC ? a.question.rubricCriteria : [],
        })),
    }));

    return ok({ classId, assessmentId, title: scheduled.assessment.title, submissions: items });
  } catch (error) {
    captureError(error);
    return fail("Could not load submissions.", 500);
  }
}

export async function PATCH(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = schoolGradeSubmissionSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());
  const { submissionId, grades } = parsed.data;

  try {
    const submission = await prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        studentId: true,
        assessment: { select: { moduleId: true } },
        enrollment: { select: { schoolClassId: true, schoolId: true } },
        answers: { select: { id: true, autoScore: true, manualScore: true, question: { select: { points: true } } } },
      },
    });
    if (!submission || !submission.enrollment?.schoolClassId) return fail("Submission not found.", 404);

    // The pupil's class must belong to THIS teacher (and school).
    if (submission.enrollment.schoolId !== schoolId) return fail("Submission not found.", 404);
    const cls = await loadOwnClass(schoolId, session!.user.id, submission.enrollment.schoolClassId);
    if (!cls) return fail("Submission not found.", 404);

    const answersById = new Map(submission.answers.map((a) => [a.id, a]));
    const gradeMap = new Map(grades.map((g) => [g.answerId, g]));
    // Every graded answerId must belong to this submission.
    for (const g of grades) {
      if (!answersById.has(g.answerId)) return fail("An answer does not belong to this submission.", 422);
    }

    const teacher = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { firstName: true, lastName: true },
    });

    await prisma.$transaction(async (tx) => {
      for (const g of grades) {
        const answer = answersById.get(g.answerId)!;
        const clamped = Math.min(Math.max(0, Math.round(g.score)), answer.question.points);
        await tx.assessmentAnswer.update({
          where: { id: g.answerId },
          data: { manualScore: clamped, gradedById: session!.user.id, gradedAt: new Date(), feedback: g.feedback ?? null },
        });
        await tx.manualGrade.create({
          data: { submissionId, answerId: g.answerId, instructorId: session!.user.id, score: clamped, feedback: g.feedback ?? null },
        });
      }

      // Recompute the total from every answer's auto + manual score (using the just-applied grades).
      const total = submission.answers.reduce((sum, a) => {
        const applied = gradeMap.get(a.id);
        const manual = applied ? Math.min(Math.max(0, Math.round(applied.score)), a.question.points) : a.manualScore;
        return sum + a.autoScore + manual;
      }, 0);

      await tx.assessmentSubmission.update({
        where: { id: submissionId },
        data: { status: AttemptStatus.GRADED, gradedAt: new Date(), manualScore: total - submission.answers.reduce((s, a) => s + a.autoScore, 0), totalScore: total },
      });
    });

    // Now that the submission is fully marked, refresh the report-only term-result gate.
    if (submission.assessment.moduleId) {
      await trySchoolAssessmentGate(submission.studentId, submission.assessment.moduleId);
    }

    const updated = await prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, status: true, autoScore: true, totalScore: true },
    });
    return ok({ submission: updated, gradedBy: teacher ? teacherDisplayName(teacher) : null });
  } catch (error) {
    captureError(error);
    return fail("Could not save the grades.", 500);
  }
}

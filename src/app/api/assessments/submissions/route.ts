import { AssessmentVerificationStatus, AttemptStatus, QuestionType, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { manualGradeSchema, submitAssessmentSchema } from "@/lib/validators";
import { trackEvent } from "@/lib/analytics";

const GRADER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];
const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const assessmentId = url.searchParams.get("assessmentId");

  if (LEARNER_ROLES.includes(session.user.role)) {
    const submissions = await prisma.assessmentSubmission.findMany({
      where: {
        studentId: session.user.id,
        assessmentId: assessmentId ?? undefined,
      },
      orderBy: { submittedAt: "desc" },
      include: {
        assessment: {
          select: { id: true, title: true, totalPoints: true, passScore: true },
        },
        answers: {
          include: {
            question: { select: { id: true, prompt: true, type: true, points: true } },
          },
        },
      },
    });
    return ok({ submissions });
  }

  if (!GRADER_ROLES.includes(session.user.role)) {
    return fail("Forbidden", 403);
  }

  const submissions = await prisma.assessmentSubmission.findMany({
    where: {
      assessmentId: assessmentId ?? undefined,
      assessment: {
        OR: [
          { createdById: session.user.id },
          {
            program: {
              organizationId: session.user.organizationId ?? undefined,
            },
          },
        ],
      },
    },
    orderBy: { submittedAt: "desc" },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      assessment: {
        select: { id: true, title: true, totalPoints: true, passScore: true },
      },
      answers: {
        include: {
          question: { select: { id: true, prompt: true, type: true, points: true } },
          selectedOption: { select: { id: true, value: true, label: true } },
        },
      },
    },
  });

  return ok({ submissions });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (!LEARNER_ROLES.includes(session.user.role)) {
    return fail("Only students and fellows can submit assessments.", 403);
  }

  try {
    const body = await request.json();
    const parsed = submitAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid submission payload.", 400, parsed.error.flatten());
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: parsed.data.assessmentId },
      include: {
        program: {
          select: {
            id: true,
            enrollments: { where: { userId: session.user.id }, select: { id: true } },
          },
        },
        questions: {
          include: { options: true },
        },
      },
    });

    if (
      !assessment ||
      !assessment.published ||
      assessment.verificationStatus !== AssessmentVerificationStatus.APPROVED
    ) {
      return fail("Assessment is not available.", 404);
    }

    const enrollment = assessment.program.enrollments[0];
    if (!enrollment) {
      return fail("You are not enrolled in this program.", 403);
    }


    const answersMap = new Map(parsed.data.answers.map((answer) => [answer.questionId, answer]));
    let autoScore = 0;
    let hasManualQuestions = false;

    const createdAnswers = assessment.questions.map((question) => {
      const incoming = answersMap.get(question.id);
      if (!incoming) {
        return {
          questionId: question.id,
          selectedOptionId: undefined as string | undefined,
          responseText: undefined as string | undefined,
          isCorrect: false,
          autoScore: 0,
        };
      }

      if (
        question.type === QuestionType.MULTIPLE_CHOICE ||
        question.type === QuestionType.TRUE_FALSE
      ) {
        const option = question.options.find((item) => item.id === incoming.selectedOptionId);
        const isCorrect = Boolean(option?.isCorrect);
        const score = isCorrect ? question.points : 0;
        autoScore += score;

        return {
          questionId: question.id,
          selectedOptionId: incoming.selectedOptionId,
          responseText: incoming.responseText,
          isCorrect,
          autoScore: score,
        };
      }

      hasManualQuestions = true;
      return {
        questionId: question.id,
        selectedOptionId: incoming.selectedOptionId,
        responseText: incoming.responseText,
        isCorrect: null,
        autoScore: 0,
      };
    });

    const status = hasManualQuestions ? AttemptStatus.IN_REVIEW : AttemptStatus.GRADED;

    const submission = await prisma.assessmentSubmission.create({
      data: {
        assessmentId: assessment.id,
        studentId: session.user.id,
        enrollmentId: enrollment.id,
        status,
        autoScore,
        totalScore: autoScore,
        gradedAt: status === AttemptStatus.GRADED ? new Date() : undefined,
        answers: {
          createMany: { data: createdAnswers },
        },
      },
      include: {
        answers: true,
      },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "assessment",
      eventName: "assessment_submitted",
      payload: { assessmentId: assessment.id, submissionId: submission.id },
    });

    return ok({ submission }, 201);
  } catch (error) {
    return fail("Could not submit assessment.", 500, error instanceof Error ? error.message : error);
  }
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (!GRADER_ROLES.includes(session.user.role)) {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = manualGradeSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid grading payload.", 400, parsed.error.flatten());
    }

    const submission = await prisma.assessmentSubmission.findUnique({
      where: { id: parsed.data.submissionId },
      include: {
        assessment: {
          select: {
            id: true,
            program: { select: { organizationId: true } },
          },
        },
        answers: { select: { id: true, autoScore: true } },
      },
    });

    if (!submission) {
      return fail("Submission not found.", 404);
    }

    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      submission.assessment.program.organizationId !== session.user.organizationId
    ) {
      return fail("Forbidden", 403);
    }

    const gradeMap = new Map(parsed.data.grades.map((grade) => [grade.answerId, grade]));

    const updated = await prisma.$transaction(async (tx) => {
      for (const answer of submission.answers) {
        const grade = gradeMap.get(answer.id);
        if (!grade) {
          continue;
        }

        await tx.assessmentAnswer.update({
          where: { id: answer.id },
          data: {
            manualScore: grade.score,
            gradedById: session.user.id,
            gradedAt: new Date(),
            feedback: grade.feedback,
          },
        });

        await tx.manualGrade.create({
          data: {
            submissionId: submission.id,
            answerId: answer.id,
            instructorId: session.user.id,
            score: grade.score,
            feedback: grade.feedback,
          },
        });
      }

      const scores = await tx.assessmentAnswer.aggregate({
        where: { submissionId: submission.id },
        _sum: { autoScore: true, manualScore: true },
      });

      return tx.assessmentSubmission.update({
        where: { id: submission.id },
        data: {
          status: AttemptStatus.GRADED,
          autoScore: scores._sum.autoScore ?? 0,
          manualScore: scores._sum.manualScore ?? 0,
          totalScore: (scores._sum.autoScore ?? 0) + (scores._sum.manualScore ?? 0),
          gradedAt: new Date(),
          feedback: parsed.data.feedback,
        },
      });
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "assessment",
      eventName: "manual_grade_submitted",
      payload: { submissionId: submission.id },
    });

    return ok({ submission: updated });
  } catch (error) {
    return fail("Could not apply manual grade.", 500, error instanceof Error ? error.message : error);
  }
}

import { AssessmentVerificationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAssessmentSchema } from "@/lib/validators";
import { trackEvent } from "@/lib/analytics";

const CREATOR_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];
const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];
const verifyAssessmentSchema = z.object({
  assessmentId: z.string().cuid(),
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(2000).optional(),
});

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const role = session.user.role;

  if (CREATOR_ROLES.includes(role)) {
    const assessments = await prisma.assessment.findMany({
      where: {
        OR: [
          { createdById: session.user.id },
          {
            program: {
              organizationId: session.user.organizationId ?? undefined,
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
        include: {
          program: { select: { id: true, name: true } },
          cohort: { select: { id: true, name: true } },
          questions: {
            select: {
              id: true,
              prompt: true,
              type: true,
              points: true,
              answerKey: true,
              options: {
                select: { id: true, label: true, value: true, isCorrect: true },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
          submissions: { select: { id: true } },
          createdBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          verifiedBy: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
        },
      });
    return ok({ assessments });
  }

  if (!LEARNER_ROLES.includes(role)) {
    return ok({ assessments: [] });
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      published: true,
      verificationStatus: AssessmentVerificationStatus.APPROVED,
      OR: [
        { cohortId: null },
        {
          cohort: {
            enrollments: {
              some: {
                userId: session.user.id,
              },
            },
          },
        },
      ],
      program: {
        enrollments: {
          some: {
            userId: session.user.id,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      program: { select: { id: true, name: true } },
      questions: {
        select: {
          id: true,
          type: true,
          points: true,
          prompt: true,
          options: { select: { id: true, label: true, value: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
      submissions: {
        where: { studentId: session.user.id },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          totalScore: true,
          autoScore: true,
          manualScore: true,
          gradedAt: true,
        },
      },
    },
  });

  return ok({ assessments });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (!CREATOR_ROLES.includes(session.user.role)) {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = createAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid assessment payload.", 400, parsed.error.flatten());
    }

    const program = await prisma.program.findUnique({
      where: { id: parsed.data.programId },
      select: { id: true, organizationId: true },
    });
    if (!program) {
      return fail("Program not found.", 404);
    }
    if (
      session.user.role !== UserRole.SUPER_ADMIN &&
      program.organizationId !== session.user.organizationId
    ) {
      return fail("Forbidden", 403);
    }

    if (parsed.data.cohortId) {
      const cohort = await prisma.cohort.findFirst({
        where: {
          id: parsed.data.cohortId,
          programId: parsed.data.programId,
        },
        select: { id: true },
      });
      if (!cohort) {
        return fail("Cohort does not belong to the selected program.", 400);
      }
    }

    const totalPoints = parsed.data.questions.reduce((sum, question) => sum + question.points, 0);

    const assessment = await prisma.assessment.create({
      data: {
        programId: parsed.data.programId,
        cohortId: parsed.data.cohortId,
        title: parsed.data.title,
        description: parsed.data.description,
        type: parsed.data.type,
        passScore: parsed.data.passScore,
        totalPoints,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        published: parsed.data.published ?? false,
        verificationStatus: AssessmentVerificationStatus.PENDING,
        verifiedById: null,
        verifiedAt: null,
        verificationNote: null,
        createdById: session.user.id,
        questions: {
          create: parsed.data.questions.map((question, index) => ({
            prompt: question.prompt,
            type: question.type,
            points: question.points,
            answerKey: question.answerKey,
            sortOrder: index + 1,
            options: question.options
              ? {
                  create: question.options.map((option) => ({
                    label: option.label,
                    value: option.value,
                    isCorrect: option.isCorrect ?? false,
                  })),
                }
              : undefined,
          })),
        },
      },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "assessment",
      eventName: "assessment_created",
      payload: {
        assessmentId: assessment.id,
        verificationStatus: AssessmentVerificationStatus.PENDING,
      },
    });

    return ok({ assessment }, 201);
  } catch (error) {
    return fail("Could not create assessment.", 500, error instanceof Error ? error.message : error);
  }
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    return fail("Only super admins can verify assessments.", 403);
  }

  try {
    const body = await request.json();
    const parsed = verifyAssessmentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid verification payload.", 400, parsed.error.flatten());
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: parsed.data.assessmentId },
      include: {
        program: { select: { organizationId: true } },
      },
    });
    if (!assessment) {
      return fail("Assessment not found.", 404);
    }

    if (
      session.user.organizationId &&
      assessment.program.organizationId !== session.user.organizationId
    ) {
      return fail("Forbidden", 403);
    }

    const nextStatus =
      parsed.data.action === "APPROVE"
        ? AssessmentVerificationStatus.APPROVED
        : AssessmentVerificationStatus.REJECTED;

    const updated = await prisma.assessment.update({
      where: { id: parsed.data.assessmentId },
      data: {
        verificationStatus: nextStatus,
        verifiedById: session.user.id,
        verifiedAt: new Date(),
        verificationNote: parsed.data.note?.trim() || null,
      },
      include: {
        program: { select: { id: true, name: true } },
        cohort: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        questions: { select: { id: true } },
        submissions: { select: { id: true } },
      },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "assessment",
      eventName: parsed.data.action === "APPROVE" ? "assessment_verified" : "assessment_rejected",
      payload: {
        assessmentId: updated.id,
        verificationStatus: updated.verificationStatus,
      },
    });

    return ok({ assessment: updated });
  } catch (error) {
    return fail("Could not verify assessment.", 500, error instanceof Error ? error.message : error);
  }
}

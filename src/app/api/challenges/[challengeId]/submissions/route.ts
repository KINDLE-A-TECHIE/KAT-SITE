import { z } from "zod";
import { NotificationType, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ challengeId: string }> }

const MANAGER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];
const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

const submitSchema = z.object({
  linkUrl: z.string().url().optional(),
  fileUrl: z.string().url().optional(),
  fileKey: z.string().optional(),
  fileName: z.string().optional(),
  fileMimeType: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
  note: z.string().max(2000).optional(),
}).refine(
  (data) => data.linkUrl || data.fileUrl,
  { message: "Either a link or a file upload is required." },
);

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!MANAGER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { challengeId } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, organizationId: true },
  });
  if (!challenge) return fail("Challenge not found.", 404);

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    challenge.organizationId !== session.user.organizationId
  ) return fail("Forbidden", 403);

  const submissions = await prisma.challengeSubmission.findMany({
    where: { challengeId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      gradedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
  });

  return ok({ submissions });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!LEARNER_ROLES.includes(session.user.role as UserRole)) return fail("Only students can submit challenges.", 403);

  const { challengeId } = await params;

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, published: true, programId: true, moduleId: true, title: true, points: true },
  });
  if (!challenge?.published) return fail("Challenge not found or not available.", 404);

  // Check enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: session.user.id, programId: challenge.programId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!enrollment) return fail("You are not enrolled in this program.", 403);

  // Check module gate if scoped
  if (challenge.moduleId) {
    const gateStatus = await prisma.moduleGateStatus.findFirst({
      where: { userId: session.user.id, moduleId: challenge.moduleId },
      select: { id: true },
    });
    if (!gateStatus) return fail("You have not reached the module for this challenge.", 403);
  }

  const body = await request.json() as unknown;
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid submission.", 400, parsed.error.flatten());

  const isNew = !(await prisma.challengeSubmission.findUnique({
    where: { challengeId_studentId: { challengeId, studentId: session.user.id } },
    select: { id: true },
  }));

  const submissionData = {
    linkUrl: parsed.data.linkUrl ?? null,
    fileUrl: parsed.data.fileUrl ?? null,
    fileKey: parsed.data.fileKey ?? null,
    fileName: parsed.data.fileName ?? null,
    fileMimeType: parsed.data.fileMimeType ?? null,
    fileSize: parsed.data.fileSize ?? null,
    note: parsed.data.note ?? null,
    // Reset grading on resubmit so the instructor re-reviews
    score: null,
    feedback: null,
    gradedById: null,
    gradedAt: null,
    submittedAt: new Date(),
  };

  const submission = await prisma.challengeSubmission.upsert({
    where: { challengeId_studentId: { challengeId, studentId: session.user.id } },
    create: { challengeId, studentId: session.user.id, ...submissionData },
    update: submissionData,
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await prisma.notification.create({
    data: {
      recipientId: session.user.id,
      creatorId: session.user.id,
      type: NotificationType.SUCCESS,
      title: isNew ? "Challenge submitted!" : "Submission updated!",
      body: JSON.stringify({
        text: isNew
          ? `Your submission for "${challenge.title}" is in. Check back for your score on the leaderboard!`
          : `Your submission for "${challenge.title}" has been updated.`,
        targetPath: "/dashboard/challenges",
      }),
    },
  });

  return ok({ submission }, isNew ? 201 : 200);
}

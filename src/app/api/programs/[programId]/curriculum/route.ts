import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCurriculumVersionSchema } from "@/lib/validators";

interface Params { params: Promise<{ programId: string }> }

const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { programId } = await params;
  const role = session.user.role as UserRole;
  const isLearner = LEARNER_ROLES.includes(role);

  // Learners must be enrolled (or fellows with an approved fellowship application for this program)
  if (isLearner) {
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_programId: { userId: session.user.id, programId } },
      select: { id: true },
    });

    if (!enrollment) {
      // Fellows may access via an approved FellowApplication linked to a cohort with this program
      if (role === UserRole.FELLOW) {
        const fellowAccess = await prisma.fellowApplication.findFirst({
          where: {
            applicantId: session.user.id,
            status: "APPROVED",
            cohort: { programId },
          },
          select: { id: true },
        });
        if (!fellowAccess) return fail("You are not enrolled in this program.", 403);
      } else {
        return fail("You are not enrolled in this program.", 403);
      }
    }
  }

  const curriculum = await prisma.curriculum.findUnique({
    where: { programId },
    include: {
      versions: {
        where: { isActive: true },
        include: {
          modules: {
            orderBy: { sortOrder: "asc" },
            include: {
              lessons: {
                orderBy: { sortOrder: "asc" },
                include: {
                  contents: {
                    where: isLearner ? { reviewStatus: ContentReviewStatus.PUBLISHED } : {},
                    orderBy: { sortOrder: "asc" },
                    select: {
                      id: true, type: true, title: true, body: true, url: true,
                      sortOrder: true, reviewStatus: true, reviewNote: true,
                      createdById: true, reviewedById: true, reviewedAt: true, createdAt: true,
                      createdBy: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return ok({ curriculum });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { programId } = await params;

  const body = await request.json();
  const parsed = createCurriculumVersionSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, organizationId: true },
  });
  if (!program) return fail("Program not found.", 404);

  // Upsert curriculum container
  const curriculum = await prisma.curriculum.upsert({
    where: { programId },
    update: {},
    create: { programId, organizationId: program.organizationId },
  });

  // Determine next version number
  const latest = await prisma.curriculumVersion.findFirst({
    where: { curriculumId: curriculum.id },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const version = await prisma.curriculumVersion.create({
    data: {
      curriculumId: curriculum.id,
      versionNumber,
      label: parsed.data.label,
      changelog: parsed.data.changelog,
      createdById: session.user.id,
    },
  });

  return ok({ version }, 201);
}
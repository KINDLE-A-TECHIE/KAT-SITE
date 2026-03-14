import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateLessonSchema } from "@/lib/validators";

interface Params { params: Promise<{ lessonId: string }> }

const LEARNER_ROLES = [UserRole.STUDENT, UserRole.FELLOW];

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { lessonId } = await params;
  const isLearner = LEARNER_ROLES.includes(session.user.role as UserRole);

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        select: {
          id: true, title: true,
          version: {
            select: {
              id: true, versionNumber: true, label: true,
              curriculum: { select: { program: { select: { id: true, name: true } } } },
            },
          },
        },
      },
      contents: {
        where: isLearner ? { reviewStatus: ContentReviewStatus.PUBLISHED } : {},
        orderBy: { sortOrder: "asc" },
        include: { createdBy: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!lesson) return fail("Lesson not found.", 404);

  // Learners must be enrolled in the program
  if (isLearner) {
    const programId = lesson.module.version.curriculum.program.id;
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_programId: { userId: session.user.id, programId } },
      select: { id: true },
    });
    if (!enrollment) return fail("You are not enrolled in this program.", 403);
  }

  return ok({ lesson });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  if (![UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR].includes(role)) {
    return fail("Forbidden", 403);
  }

  const { lessonId } = await params;
  const body = await request.json();
  const parsed = updateLessonSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
    },
  });

  return ok({ lesson });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  if (![UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(session.user.role as UserRole)) {
    return fail("Forbidden", 403);
  }

  const { lessonId } = await params;
  await prisma.lesson.delete({ where: { id: lessonId } });

  return ok({ deleted: true });
}
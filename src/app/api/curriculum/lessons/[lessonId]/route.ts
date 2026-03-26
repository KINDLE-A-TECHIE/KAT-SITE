import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateLessonSchema } from "@/lib/validators";

interface Params { params: Promise<{ lessonId: string }> }

const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

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
              // Fetch all modules + lessons for prev/next navigation
              modules: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  sortOrder: true,
                  lessons: {
                    orderBy: { sortOrder: "asc" },
                    select: { id: true, title: true },
                  },
                },
              },
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

  // Learners must be enrolled
  if (isLearner) {
    const programId = lesson.module.version.curriculum.program.id;
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_programId: { userId: session.user.id, programId } },
      select: { id: true },
    });
    if (!enrollment) return fail("You are not enrolled in this program.", 403);
  }

  // Build flat ordered lesson list for prev/next
  const allLessons = lesson.module.version.modules.flatMap((m) =>
    m.lessons.map((l) => ({ id: l.id, title: l.title }))
  );
  const currentIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  // Check if this lesson is already completed (learners only)
  let isCompleted = false;
  if (isLearner) {
    const progress = await prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
      select: { id: true },
    });
    isCompleted = !!progress;
  }

  // Strip the navigation data from the lesson object before returning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { module: { version: { modules: _modules, ...versionRest }, ...moduleRest }, ...lessonRest } = lesson;

  return ok({
    lesson: {
      ...lessonRest,
      module: { ...moduleRest, version: { ...versionRest } },
    },
    prevLesson,
    nextLesson,
    isCompleted,
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR] as UserRole[]).includes(role)) {
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

  if (!([UserRole.SUPER_ADMIN, UserRole.ADMIN] as UserRole[]).includes(session.user.role as UserRole)) {
    return fail("Forbidden", 403);
  }

  const { lessonId } = await params;
  await prisma.lesson.delete({ where: { id: lessonId } });

  return ok({ deleted: true });
}

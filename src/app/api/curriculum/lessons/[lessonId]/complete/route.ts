import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ lessonId: string }> }

const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

export async function POST(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  // Only learners track progress
  if (!LEARNER_ROLES.includes(session.user.role as UserRole)) {
    return ok({ completed: false, badgeEarned: null });
  }

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      moduleId: true,
      module: {
        select: {
          id: true,
          badge: { select: { id: true, name: true, icon: true, color: true } },
          lessons: { select: { id: true }, orderBy: { sortOrder: "asc" } },
          version: {
            select: { curriculum: { select: { programId: true } } },
          },
        },
      },
    },
  });

  if (!lesson) return fail("Lesson not found.", 404);

  // Verify enrollment
  const programId = lesson.module.version.curriculum.programId;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_programId: { userId: session.user.id, programId } },
    select: { id: true },
  });
  if (!enrollment) return fail("Not enrolled in this program.", 403);

  // Upsert progress (idempotent — safe to call multiple times)
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    create: { userId: session.user.id, lessonId },
    update: {},
  });

  // Check if all lessons in the module are now complete → award badge
  let badgeEarned: { id: string; name: string; icon: string; color: string } | null = null;

  if (lesson.module.badge) {
    const moduleLessonIds = lesson.module.lessons.map((l) => l.id);
    const completedCount = await prisma.lessonProgress.count({
      where: { userId: session.user.id, lessonId: { in: moduleLessonIds } },
    });

    if (completedCount === moduleLessonIds.length) {
      // All lessons done — award badge (upsert so it's idempotent)
      const badge = lesson.module.badge;
      const existing = await prisma.userBadge.findUnique({
        where: { userId_badgeId: { userId: session.user.id, badgeId: badge.id } },
      });
      if (!existing) {
        await prisma.userBadge.create({
          data: { userId: session.user.id, badgeId: badge.id },
        });
        badgeEarned = badge;
      }
    }
  }

  return ok({ completed: true, badgeEarned });
}

import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getModuleGatesForUser } from "@/lib/mastery";

interface Params { params: Promise<{ programId: string }> }

const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  if (!LEARNER_ROLES.includes(session.user.role as UserRole)) {
    return ok({ completedLessonIds: [] });
  }

  const { programId } = await params;

  // Verify enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_programId: { userId: session.user.id, programId } },
    select: { id: true },
  });
  if (!enrollment) return fail("Not enrolled in this program.", 403);

  // Get all lesson IDs in this program
  const curriculum = await prisma.curriculum.findUnique({
    where: { programId },
    select: {
      versions: {
        where: { isActive: true },
        take: 1,
        select: {
          modules: {
            select: { id: true, lessons: { select: { id: true } } },
          },
        },
      },
    },
  });

  const modules = curriculum?.versions[0]?.modules ?? [];
  const allModuleIds = modules.map((m) => m.id);
  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

  if (allLessonIds.length === 0 && allModuleIds.length === 0) {
    return ok({ completedLessonIds: [], moduleGates: {} });
  }

  const [progress, moduleGates] = await Promise.all([
    allLessonIds.length > 0
      ? prisma.lessonProgress.findMany({
          where: { userId: session.user.id, lessonId: { in: allLessonIds } },
          select: { lessonId: true },
        })
      : Promise.resolve([]),
    getModuleGatesForUser(session.user.id, allModuleIds),
  ]);

  return ok({ completedLessonIds: progress.map((p) => p.lessonId), moduleGates });
}

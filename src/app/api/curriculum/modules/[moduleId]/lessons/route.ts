import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLessonSchema } from "@/lib/validators";

interface Params { params: Promise<{ moduleId: string }> }

const CREATOR_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];
const LEARNER_ROLES = [UserRole.STUDENT, UserRole.FELLOW];

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { moduleId } = await params;
  const isLearner = LEARNER_ROLES.includes(session.user.role as UserRole);

  const lessons = await prisma.lesson.findMany({
    where: { moduleId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          contents: isLearner
            ? { where: { reviewStatus: ContentReviewStatus.PUBLISHED } }
            : true,
        },
      },
    },
  });

  return ok({ lessons });
}

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!CREATOR_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { moduleId } = await params;

  const module = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true } });
  if (!module) return fail("Module not found.", 404);

  const body = await request.json();
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  let sortOrder = parsed.data.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.lesson.findFirst({
      where: { moduleId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const lesson = await prisma.lesson.create({
    data: { moduleId, title: parsed.data.title, description: parsed.data.description, sortOrder },
  });

  return ok({ lesson }, 201);
}
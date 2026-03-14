import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLessonContentSchema } from "@/lib/validators";

interface Params { params: Promise<{ lessonId: string }> }

const CREATOR_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!(CREATOR_ROLES as UserRole[]).includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return fail("Lesson not found.", 404);

  const body = await request.json();
  const parsed = createLessonContentSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  // Validate that the right field is provided per type
  if (parsed.data.type === "RICH_TEXT" && !parsed.data.body) {
    return fail("Body is required for rich text content.", 400);
  }
  if (parsed.data.type === "CODE_PLAYGROUND") {
    if (!parsed.data.body) return fail("Starter code is required for code playground.", 400);
    if (!parsed.data.language) return fail("Language is required for code playground.", 400);
  }
  if (parsed.data.type !== "RICH_TEXT" && parsed.data.type !== "CODE_PLAYGROUND" && !parsed.data.url) {
    return fail("URL is required for this content type.", 400);
  }

  let sortOrder = parsed.data.sortOrder;
  if (sortOrder === undefined) {
    const last = await prisma.lessonContent.findFirst({
      where: { lessonId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? -1) + 1;
  }

  const content = await prisma.lessonContent.create({
    data: {
      lessonId,
      type: parsed.data.type,
      title: parsed.data.title,
      body: parsed.data.body,
      url: parsed.data.url,
      language: parsed.data.language,
      sortOrder,
      reviewStatus: ContentReviewStatus.PENDING_REVIEW,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { firstName: true, lastName: true } } },
  });

  return ok({ content }, 201);
}
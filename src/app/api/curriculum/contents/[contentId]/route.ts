import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateLessonContentSchema } from "@/lib/validators";

interface Params { params: Promise<{ contentId: string }> }

const CREATOR_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  if (!CREATOR_ROLES.includes(role)) return fail("Forbidden", 403);

  const { contentId } = await params;

  const existing = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { id: true, createdById: true },
  });
  if (!existing) return fail("Content not found.", 404);

  // Instructors can only edit their own content
  if (role === UserRole.INSTRUCTOR && existing.createdById !== session.user.id) {
    return fail("Forbidden", 403);
  }

  const body = await request.json();
  const parsed = updateLessonContentSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  // Non-SA edits reset review status
  const resetReview = role !== UserRole.SUPER_ADMIN;

  const content = await prisma.lessonContent.update({
    where: { id: contentId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.body !== undefined && { body: parsed.data.body }),
      ...(parsed.data.url !== undefined && { url: parsed.data.url }),
      ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
      ...(resetReview && {
        reviewStatus: ContentReviewStatus.PENDING_REVIEW,
        reviewedById: null,
        reviewedAt: null,
        reviewNote: null,
      }),
    },
  });

  return ok({ content });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  if (!CREATOR_ROLES.includes(role)) return fail("Forbidden", 403);

  const { contentId } = await params;

  const existing = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { id: true, createdById: true },
  });
  if (!existing) return fail("Content not found.", 404);

  if (role === UserRole.INSTRUCTOR && existing.createdById !== session.user.id) {
    return fail("Forbidden", 403);
  }

  await prisma.lessonContent.delete({ where: { id: contentId } });
  return ok({ deleted: true });
}
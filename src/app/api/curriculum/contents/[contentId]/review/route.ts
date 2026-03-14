import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reviewLessonContentSchema } from "@/lib/validators";

interface Params { params: Promise<{ contentId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { contentId } = await params;

  const body = await request.json();
  const parsed = reviewLessonContentSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const existing = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { id: true },
  });
  if (!existing) return fail("Content not found.", 404);

  const reviewStatus =
    parsed.data.action === "PUBLISH"
      ? ContentReviewStatus.PUBLISHED
      : ContentReviewStatus.REJECTED;

  const content = await prisma.lessonContent.update({
    where: { id: contentId },
    data: {
      reviewStatus,
      reviewedById: session.user.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.note ?? null,
    },
  });

  return ok({ content });
}
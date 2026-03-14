import { ContentReviewStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { searchParams } = new URL(request.url);
  const programId = searchParams.get("programId") ?? undefined;
  const statusParam = searchParams.get("status");
  const reviewStatus =
    statusParam === "PUBLISHED"
      ? ContentReviewStatus.PUBLISHED
      : statusParam === "REJECTED"
        ? ContentReviewStatus.REJECTED
        : ContentReviewStatus.PENDING_REVIEW;

  const items = await prisma.lessonContent.findMany({
    where: {
      reviewStatus,
      ...(programId && {
        lesson: {
          module: {
            version: { curriculum: { programId } },
          },
        },
      }),
    },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      lesson: {
        select: {
          id: true,
          title: true,
          module: {
            select: {
              id: true,
              title: true,
              version: {
                select: {
                  id: true,
                  versionNumber: true,
                  label: true,
                  curriculum: {
                    select: {
                      program: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return ok({ items, total: items.length });
}
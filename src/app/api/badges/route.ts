import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list earned badges for the current user (or a specific user for admins)
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get("userId");

  const isAdmin = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"].includes(session.user.role);

  // Only admins can query another user's badges
  const userId = targetUserId && isAdmin ? targetUserId : session.user.id;

  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    orderBy: { earnedAt: "desc" },
    include: {
      badge: {
        include: {
          module: {
            select: {
              id: true,
              title: true,
              version: {
                select: {
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

  return ok({ badges: userBadges });
}

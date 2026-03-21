import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";

/**
 * GET /api/super-admin/promote?email=xxx
 * Look up an existing user by email — returns name + current role.
 *
 * POST /api/super-admin/promote { userId }
 * Promote an existing user to SUPER_ADMIN.
 */

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return fail("email query param is required.", 400);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  });
  if (!user) return fail("No user found with that email.", 404);

  return ok({ user });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const body = (await request.json()) as { userId?: string };
  if (!body.userId) return fail("userId is required.", 400);

  const target = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, role: true, firstName: true, lastName: true, email: true },
  });
  if (!target) return fail("User not found.", 404);
  if (target.role === UserRole.SUPER_ADMIN) return fail("User is already a super admin.", 409);

  await prisma.user.update({
    where: { id: body.userId },
    data: { role: UserRole.SUPER_ADMIN },
  });

  await trackEvent({
    userId: session.user.id,
    eventType: "auth",
    eventName: "super_admin_promoted",
    payload: { promotedUserId: target.id, promotedUserEmail: target.email, promotedBy: session.user.id },
  });

  return ok({ message: `${target.firstName} ${target.lastName} has been promoted to Super Admin.` });
}

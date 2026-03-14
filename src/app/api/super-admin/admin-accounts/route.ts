import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { adminAccountDeleteSchema, adminAccountUpdateSchema } from "@/lib/validators";

function ensureSuperAdmin(role: UserRole) {
  if (role !== UserRole.SUPER_ADMIN) {
    throw new Error("Forbidden");
  }
}

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    ensureSuperAdmin(session.user.role);
  } catch {
    return fail("Forbidden", 403);
  }

  const admins = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.INSTRUCTOR] },
      organizationId: session.user.organizationId ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      adminInvitesUsed: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          createdAt: true,
        },
      },
    },
  });

  return ok({
    admins: admins.map((admin) => ({
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
      invitedBy: admin.adminInvitesUsed[0]?.createdBy ?? null,
      invitedAt: admin.adminInvitesUsed[0]?.createdAt ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    ensureSuperAdmin(session.user.role);
  } catch {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = adminAccountUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid request payload.", 400, parsed.error.flatten());
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.adminId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target || (target.role !== UserRole.ADMIN && target.role !== UserRole.INSTRUCTOR)) {
      return fail("Account not found.", 404);
    }

    const nextIsActive = parsed.data.action === "activate";
    await prisma.user.update({
      where: { id: target.id },
      data: { isActive: nextIsActive },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId ?? undefined,
      eventType: "auth",
      eventName: nextIsActive ? "admin_account_activated" : "admin_account_held",
      payload: { adminId: target.id, role: target.role },
    });

    return ok({ success: true });
  } catch (error) {
    return fail("Could not update admin account.", 500, error instanceof Error ? error.message : error);
  }
}

export async function DELETE(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    ensureSuperAdmin(session.user.role);
  } catch {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = adminAccountDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid request payload.", 400, parsed.error.flatten());
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.adminId },
      select: { id: true, role: true },
    });
    if (!target || (target.role !== UserRole.ADMIN && target.role !== UserRole.INSTRUCTOR)) {
      return fail("Account not found.", 404);
    }

    await prisma.user.delete({
      where: { id: target.id },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId ?? undefined,
      eventType: "auth",
      eventName: "admin_account_removed",
      payload: { adminId: target.id, role: target.role },
    });

    return ok({ success: true });
  } catch (error) {
    return fail("Could not remove admin account.", 500, error instanceof Error ? error.message : error);
  }
}

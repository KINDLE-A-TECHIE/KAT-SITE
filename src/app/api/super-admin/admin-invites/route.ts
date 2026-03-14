import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { adminInviteCreateSchema } from "@/lib/validators";
import {
  buildAdminInviteUrl,
  generateAdminInviteToken,
  getAdminInviteStatus,
  hashAdminInviteToken,
  normalizeEmail,
} from "@/lib/admin-invite";

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

  const invites = await prisma.adminInvite.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      usedBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    take: 100,
  });

  return ok({
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
      revokedAt: invite.revokedAt,
      createdAt: invite.createdAt,
      createdBy: invite.createdBy,
      usedBy: invite.usedBy,
      status: getAdminInviteStatus(invite),
    })),
  });
}

export async function POST(request: Request) {
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
    const parsed = adminInviteCreateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid invite payload.", 400, parsed.error.flatten());
    }

    const email = normalizeEmail(parsed.data.email);
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (existingUser) {
      return fail("A user with this email already exists.", 409);
    }

    const token = generateAdminInviteToken();
    const tokenHash = hashAdminInviteToken(token);
    const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000);

    const invite = await prisma.adminInvite.create({
      data: {
        email,
        role: parsed.data.role,
        tokenHash,
        expiresAt,
        createdById: session.user.id,
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    const inviteUrl = buildAdminInviteUrl(token);

    await trackEvent({
      userId: session.user.id,
      eventType: "auth",
      eventName: "admin_invite_created",
      payload: {
        inviteId: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });

    return ok(
      {
        invite,
        inviteUrl,
      },
      201,
    );
  } catch (error) {
    return fail("Could not create invite.", 500, error instanceof Error ? error.message : error);
  }
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
    const body = (await request.json()) as { inviteId?: string; revoke?: boolean };
    if (!body.inviteId) {
      return fail("inviteId is required.", 400);
    }

    const invite = await prisma.adminInvite.findUnique({
      where: { id: body.inviteId },
      select: { id: true, usedAt: true, revokedAt: true },
    });
    if (!invite) {
      return fail("Invite not found.", 404);
    }
    if (invite.usedAt) {
      return fail("Used invites cannot be revoked.", 400);
    }
    if (invite.revokedAt) {
      return ok({ success: true });
    }

    await prisma.adminInvite.update({
      where: { id: body.inviteId },
      data: { revokedAt: new Date() },
    });

    await trackEvent({
      userId: session.user.id,
      eventType: "auth",
      eventName: "admin_invite_revoked",
      payload: { inviteId: body.inviteId },
    });

    return ok({ success: true });
  } catch (error) {
    return fail("Could not update invite.", 500, error instanceof Error ? error.message : error);
  }
}

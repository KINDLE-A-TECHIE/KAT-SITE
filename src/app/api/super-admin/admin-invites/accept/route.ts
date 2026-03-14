import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  adminInviteAcceptSchema,
  adminInviteValidateSchema,
} from "@/lib/validators";
import {
  getAdminInviteStatus,
  hashAdminInviteToken,
  normalizeEmail,
} from "@/lib/admin-invite";
import { trackEvent } from "@/lib/analytics";
import { ensureDefaultOrganization } from "@/lib/default-organization";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const parsed = adminInviteValidateSchema.safeParse({ token });
  if (!parsed.success) {
    return fail("Invalid invite token.", 400);
  }

  const invite = await prisma.adminInvite.findUnique({
    where: {
      tokenHash: hashAdminInviteToken(parsed.data.token),
    },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  if (!invite) {
    return fail("Invite not found.", 404);
  }

  const status = getAdminInviteStatus(invite);
  if (status !== "valid") {
    return fail(`Invite is ${status}.`, 400);
  }

  return ok({
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      status,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = adminInviteAcceptSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid invite acceptance payload.", 400, parsed.error.flatten());
    }

    const tokenHash = hashAdminInviteToken(parsed.data.token);
    const email = normalizeEmail(parsed.data.email);

    const invite = await prisma.adminInvite.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        createdById: true,
        createdBy: {
          select: {
            organizationId: true,
          },
        },
      },
    });

    if (!invite) {
      return fail("Invite not found.", 404);
    }

    const status = getAdminInviteStatus(invite);
    if (status !== "valid") {
      return fail(`Invite is ${status}.`, 400);
    }

    if (normalizeEmail(invite.email) !== email) {
      return fail("Invite email does not match.", 403);
    }

    if (invite.role !== UserRole.ADMIN && invite.role !== UserRole.INSTRUCTOR) {
      return fail("Invite role is not eligible for this flow.", 400);
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (existing) {
      return fail("A user with this email already exists.", 409);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const defaultOrganization = await ensureDefaultOrganization();
    const organizationId = invite.createdBy.organizationId ?? defaultOrganization.id;

    const result = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          passwordHash,
          role: invite.role,
          organizationId,
          profile: { create: {} },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      await tx.adminInvite.update({
        where: { id: invite.id },
        data: {
          usedAt: new Date(),
          usedById: createdUser.id,
        },
      });

      return createdUser;
    });

    await trackEvent({
      userId: result.id,
      organizationId,
      eventType: "auth",
      eventName: "admin_invite_accepted",
      payload: {
        inviteId: invite.id,
        role: invite.role,
        createdById: invite.createdById,
      },
    });

    return ok({ user: result }, 201);
  } catch (error) {
    return fail("Could not accept invite.", 500, error instanceof Error ? error.message : error);
  }
}

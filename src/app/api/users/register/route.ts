import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { ensureDefaultOrganization } from "@/lib/default-organization";
import { registerSchema } from "@/lib/validators";
import { trackEvent } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return fail("Invalid registration payload.", 400, parsed.error.flatten());
    }

    if (parsed.data.role === UserRole.SUPER_ADMIN) {
      return fail("Super admin accounts must be provisioned internally.", 403);
    }

    if (parsed.data.role === UserRole.ADMIN) {
      return fail("Admin accounts must be provisioned through a super admin invite.", 403);
    }

    if (parsed.data.role === UserRole.INSTRUCTOR) {
      return fail("Instructor accounts must be provisioned through a super admin invite.", 403);
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existing) {
      return fail("Email already exists.", 409);
    }

    const defaultOrganization = await ensureDefaultOrganization();

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const created = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: parsed.data.role,
        organizationId: defaultOrganization.id,
        profile: {
          create: {},
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationId: true,
      },
    });

    await trackEvent({
      userId: created.id,
      organizationId: created.organizationId,
      eventType: "auth",
      eventName: "registration",
      payload: { role: created.role },
    });

    return ok({ user: created }, 201);
  } catch (error) {
    return fail("Registration failed.", 500, error instanceof Error ? error.message : error);
  }
}

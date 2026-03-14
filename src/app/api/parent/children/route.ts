import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { ensureDefaultOrganization } from "@/lib/default-organization";
import bcrypt from "bcryptjs";

// Link an existing student account by email.
const linkChildSchema = z.object({
  email: z.string().email(),
});

// Register a brand-new student account for the child.
const registerChildSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

// GET — list parent's linked children with their enrollments.
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.PARENT) return fail("Forbidden", 403);

  const links = await prisma.parentStudent.findMany({
    where: { parentId: session.user.id },
    include: {
      child: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          enrollments: {
            include: {
              program: { select: { id: true, name: true, monthlyFee: true } },
              cohort: { select: { id: true, name: true } },
            },
            where: { status: "ACTIVE" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok({ children: links.map((l) => l.child) });
}

// POST — either register a new child account (action: "register")
//         or link an existing student account (action: "link").
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.PARENT) return fail("Forbidden", 403);

  const body = await request.json() as { action?: string } & Record<string, unknown>;
  const action = body.action ?? "link";

  try {
    if (action === "register") {
      const parsed = registerChildSchema.safeParse(body);
      if (!parsed.success) {
        return fail("Invalid registration payload.", 400, parsed.error.flatten());
      }

      const existing = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      });
      if (existing) {
        return fail("An account with this email already exists. Use 'link' to connect to it.", 409);
      }

      const defaultOrg = await ensureDefaultOrganization();
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);

      const child = await prisma.user.create({
        data: {
          email: parsed.data.email,
          passwordHash,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          role: UserRole.STUDENT,
          organizationId: defaultOrg.id,
          profile: { create: {} },
          childLinks: {
            create: { parentId: session.user.id },
          },
        },
        select: {
          id: true, firstName: true, lastName: true, email: true, role: true,
        },
      });

      await trackEvent({
        userId: session.user.id,
        organizationId: session.user.organizationId,
        eventType: "parent",
        eventName: "child_registered",
        payload: { childId: child.id },
      });

      return ok({ child }, 201);
    }

    if (action === "link") {
      const parsed = linkChildSchema.safeParse(body);
      if (!parsed.success) {
        return fail("Invalid link payload.", 400, parsed.error.flatten());
      }

      const child = await prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      });

      if (!child) return fail("No account found with that email.", 404);
      if (child.role !== UserRole.STUDENT) {
        return fail("Only student accounts can be linked to a parent.", 400);
      }

      await prisma.parentStudent.upsert({
        where: { parentId_childId: { parentId: session.user.id, childId: child.id } },
        update: {},
        create: { parentId: session.user.id, childId: child.id },
      });

      await trackEvent({
        userId: session.user.id,
        organizationId: session.user.organizationId,
        eventType: "parent",
        eventName: "child_linked",
        payload: { childId: child.id },
      });

      return ok({ child });
    }

    return fail("Unknown action. Use 'register' or 'link'.", 400);
  } catch (error) {
    return fail("Operation failed.", 500, error instanceof Error ? error.message : error);
  }
}

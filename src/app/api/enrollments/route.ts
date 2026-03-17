import { EnrollmentStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";

const createEnrollmentSchema = z.object({
  userId: z.string().cuid().optional(),
  programId: z.string().cuid(),
});

const updateEnrollmentSchema = z.object({
  enrollmentId: z.string().cuid(),
  status: z.nativeEnum(EnrollmentStatus),
});

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const isAdmin = session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;

  const url = new URL(request.url);
  const filterUserId = url.searchParams.get("userId");

  // Admins may filter by a specific userId; non-admins always see only their own.
  const targetUserId =
    isAdmin && filterUserId ? filterUserId : session.user.id;

  const enrollments = await prisma.enrollment.findMany({
    where: isAdmin && !filterUserId
      ? {
          program: { organizationId: session.user.organizationId ?? undefined },
        }
      : {
          userId: targetUserId,
        },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
      program: {
        select: { id: true, name: true, monthlyFee: true, level: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ enrollments });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const parsed = createEnrollmentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid enrollment payload.", 400, parsed.error.flatten());
    }

    const targetUserId = parsed.data.userId ?? session.user.id;
    const actingAsAnotherUser = targetUserId !== session.user.id;
    if (actingAsAnotherUser) {
      const isStaff =
        session.user.role === UserRole.SUPER_ADMIN ||
        session.user.role === UserRole.ADMIN ||
        session.user.role === UserRole.INSTRUCTOR;

      // Parents may enroll their own linked children.
      const isParentOfChild =
        session.user.role === UserRole.PARENT &&
        (await prisma.parentStudent.findUnique({
          where: { parentId_childId: { parentId: session.user.id, childId: targetUserId } },
          select: { childId: true },
        })) !== null;

      if (!isStaff && !isParentOfChild) {
        return fail("Forbidden", 403);
      }
    }

    const enrollment = await prisma.enrollment.upsert({
      where: {
        userId_programId: {
          userId: targetUserId,
          programId: parsed.data.programId,
        },
      },
      update: {
        status: EnrollmentStatus.ACTIVE,
      },
      create: {
        userId: targetUserId,
        programId: parsed.data.programId,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        program: { select: { id: true, name: true } },
      },
    });

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "enrollment",
      eventName: "enrollment_created",
      payload: {
        enrollmentId: enrollment.id,
        targetUserId,
        programId: parsed.data.programId,
      },
    });

    return ok({ enrollment }, 201);
  } catch (error) {
    return fail("Could not create enrollment.", 500, error instanceof Error ? error.message : error);
  }
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  const isAdmin = session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  if (!isAdmin) {
    return fail("Forbidden", 403);
  }

  const body = await request.json();
  const parsed = updateEnrollmentSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid update payload.", 400, parsed.error.flatten());
  }

  const enrollment = await prisma.enrollment.update({
    where: { id: parsed.data.enrollmentId },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === EnrollmentStatus.COMPLETED ? new Date() : null,
    },
  });

  return ok({ enrollment });
}

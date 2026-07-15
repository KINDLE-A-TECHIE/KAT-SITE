import { EnrollmentPeriodReason, EnrollmentStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";
import { orgScope } from "@/lib/tenant";

const createEnrollmentSchema = z.object({
  userId: z.string().cuid().optional(),
  programId: z.string().cuid(),
  billingType: z.enum(["WAIVED", "BILLABLE"]).optional(),
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
          program: orgScope(session.user.organizationId),
        }
      : {
          userId: targetUserId,
        },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
      program: {
        select: { id: true, name: true, monthlyFee: true, level: true, isActive: true },
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

    // billingType is only honoured when a staff member enrolls someone else
    const isManualByStaff = actingAsAnotherUser;
    const billingType = parsed.data.billingType ?? "WAIVED"; // default waived for manual
    const isBillingWaived = !isManualByStaff ? false : billingType === "WAIVED";
    const billingPeriodEnd = isManualByStaff && billingType === "BILLABLE"
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : undefined;

    // Check if a prior enrollment exists (could be suspended/dropped)
    const existing = await prisma.enrollment.findUnique({
      where: { userId_programId: { userId: targetUserId, programId: parsed.data.programId } },
      select: { id: true, status: true },
    });

    const isReactivation = !!existing && existing.status !== EnrollmentStatus.ACTIVE;
    const isFirstTime = !existing;

    const startReason: EnrollmentPeriodReason = isFirstTime
      ? EnrollmentPeriodReason.INITIAL
      : isReactivation
        ? (isBillingWaived ? EnrollmentPeriodReason.WAIVED : EnrollmentPeriodReason.REACTIVATION)
        : (isBillingWaived ? EnrollmentPeriodReason.WAIVED : EnrollmentPeriodReason.MANUAL);

    // ONE TRANSACTION. An enrollment without its billing period is a child who is enrolled and
    // billed for nothing, and a crash between the two writes would leave exactly that. They land
    // together or not at all.
    const enrollment = await prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.upsert({
        where: {
          userId_programId: {
            userId: targetUserId,
            programId: parsed.data.programId,
          },
        },
        update: {
          status: EnrollmentStatus.ACTIVE,
          ...(isManualByStaff && {
            isBillingWaived,
            currentPeriodEnd: billingType === "BILLABLE" ? billingPeriodEnd : null,
          }),
        },
        create: {
          userId: targetUserId,
          programId: parsed.data.programId,
          isBillingWaived,
          currentPeriodEnd: billingPeriodEnd,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          program: { select: { id: true, name: true } },
        },
      });

      // Close any stale open period before opening the new one.
      await tx.enrollmentPeriod.updateMany({
        where: { enrollmentId: created.id, endedAt: null },
        data: { endedAt: new Date(), endReason: "MANUAL" },
      });
      await tx.enrollmentPeriod.create({
        data: { enrollmentId: created.id, startReason },
      });

      return created;
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

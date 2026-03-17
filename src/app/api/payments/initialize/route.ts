import { PaymentStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initializePaymentSchema } from "@/lib/validators";
import { getPaymentGateway } from "@/lib/payments/provider";
import { trackEvent } from "@/lib/analytics";

function generatePaymentReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAT-${stamp}-${random}`;
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const parsed = initializePaymentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid payment payload.", 400, parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, organizationId: true, role: true },
    });

    if (!user) return fail("User not found.", 404);

    // ── Application fee path (external fellow applicants only) ─────────────────
    if (parsed.data.fellowApplicationId) {
      const application = await prisma.fellowApplication.findUnique({
        where: { id: parsed.data.fellowApplicationId },
        include: { cohort: { select: { programId: true } } },
      });
      if (!application) return fail("Application not found.", 404);
      if (application.applicantId !== session.user.id) return fail("Forbidden", 403);
      if (!application.isExternalApplicant) {
        return fail("Internal students do not pay an application fee.", 400);
      }

      const existingFee = await prisma.payment.findUnique({
        where: { fellowApplicationId: parsed.data.fellowApplicationId },
        select: { id: true, status: true },
      });
      if (existingFee?.status === PaymentStatus.SUCCESS) {
        return fail("Application fee already paid.", 409);
      }

      const billingMonth = new Date();
      billingMonth.setDate(1);
      billingMonth.setHours(0, 0, 0, 0);

      const reference = generatePaymentReference();
      const callbackUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/payments?reference=${reference}`;

      const payment = await prisma.payment.create({
        data: {
          userId: session.user.id,
          fellowApplicationId: application.id,
          programId: application.cohort?.programId ?? null,
          provider: parsed.data.provider,
          status: PaymentStatus.PENDING,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          reference,
          billingMonth,
          metadata: { type: "application_fee", applicationId: application.id },
        },
      });

      let authorizationUrl = `${callbackUrl}&mock=true`;
      let accessCode: string | undefined;

      if (parsed.data.provider === "PAYSTACK" && process.env.PAYSTACK_SECRET_KEY) {
        const gateway = getPaymentGateway(parsed.data.provider);
        const initialized = await gateway.initialize({
          email: user.email,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          reference,
          callbackUrl,
        });
        authorizationUrl = initialized.authorizationUrl;
        accessCode = initialized.accessCode;
      }

      await trackEvent({
        userId: session.user.id,
        organizationId: user.organizationId,
        eventType: "payment",
        eventName: "application_fee_initialized",
        payload: { reference, applicationId: application.id },
      });

      return ok({ payment: { id: payment.id, reference, status: payment.status, amount: Number(payment.amount), currency: payment.currency, provider: payment.provider }, authorizationUrl, accessCode }, 201);
    }

    // ── Standard enrollment payment path ───────────────────────────────────────
    if (!parsed.data.programId) return fail("programId is required for enrollment payments.", 400);
    if (!parsed.data.billingMonth) return fail("billingMonth is required for enrollment payments.", 400);

    // Parents can pay on behalf of a ward (child). Resolve the billing target.
    let targetUserId = session.user.id;
    if (parsed.data.wardId) {
      if (
        user.role !== UserRole.PARENT &&
        user.role !== UserRole.SUPER_ADMIN &&
        user.role !== UserRole.ADMIN
      ) {
        return fail("Only parents can pay on behalf of a ward.", 403);
      }
      if (user.role === UserRole.PARENT) {
        const link = await prisma.parentStudent.findUnique({
          where: {
            parentId_childId: { parentId: session.user.id, childId: parsed.data.wardId },
          },
          select: { childId: true },
        });
        if (!link) {
          return fail("This student is not linked to your account.", 403);
        }
      }
      targetUserId = parsed.data.wardId;
    }

    const program = await prisma.program.findUnique({
      where: { id: parsed.data.programId },
      select: { id: true, organizationId: true },
    });
    if (!program) {
      return fail("Program not found.", 404);
    }

    if (
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.ADMIN &&
      user.organizationId &&
      program.organizationId !== user.organizationId
    ) {
      return fail("Forbidden", 403);
    }

    // Resolve or auto-create enrollment for the target user + program.
    let resolvedEnrollmentId = parsed.data.enrollmentId;

    if (resolvedEnrollmentId) {
      // Verify the provided enrollmentId belongs to the target user and program.
      const enrollment = await prisma.enrollment.findUnique({
        where: { id: resolvedEnrollmentId },
        select: { userId: true, programId: true },
      });
      if (
        !enrollment ||
        enrollment.programId !== parsed.data.programId ||
        (enrollment.userId !== targetUserId &&
          user.role !== UserRole.SUPER_ADMIN &&
          user.role !== UserRole.ADMIN)
      ) {
        return fail("Invalid enrollment for this program.", 400);
      }
    } else {
      // No enrollmentId supplied — find or create one for the target user.
      const existing = await prisma.enrollment.findUnique({
        where: { userId_programId: { userId: targetUserId, programId: parsed.data.programId } },
        select: { id: true },
      });
      if (existing) {
        resolvedEnrollmentId = existing.id;
      } else {
        // Auto-enroll the target user (allowed for parents paying for their child).
        const newEnrollment = await prisma.enrollment.create({
          data: { userId: targetUserId, programId: parsed.data.programId },
          select: { id: true },
        });
        resolvedEnrollmentId = newEnrollment.id;
      }
    }

    // Prevent duplicate payments for the same target user + program + billing month.
    const billingMonthDate = new Date(parsed.data.billingMonth);
    const existing = await prisma.payment.findFirst({
      where: {
        userId: targetUserId,
        programId: parsed.data.programId,
        billingMonth: billingMonthDate,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
      },
      select: { id: true, status: true },
    });
    if (existing) {
      return fail(
        existing.status === PaymentStatus.SUCCESS
          ? "This billing month has already been paid."
          : "A pending payment already exists for this billing month.",
        409,
      );
    }

    // Validate discount code if provided
    let resolvedDiscountCodeId: string | null = null;
    let finalAmount = parsed.data.amount;

    if (parsed.data.discountCode) {
      const dc = await prisma.discountCode.findUnique({
        where: { code: parsed.data.discountCode },
      });

      if (!dc || !dc.isActive) return fail("Invalid or expired discount code.", 422);
      if (dc.expiresAt && dc.expiresAt < new Date()) return fail("This discount code has expired.", 422);
      if (dc.maxUses !== null && dc.usedCount >= dc.maxUses) return fail("This discount code has reached its usage limit.", 422);
      if (dc.programId && dc.programId !== parsed.data.programId) return fail("This code is not valid for the selected program.", 422);

      const pct = Number(dc.discountPercent);
      finalAmount = Math.round(parsed.data.amount * (1 - pct / 100));
      resolvedDiscountCodeId = dc.id;
    }

    const reference = generatePaymentReference();
    const callbackUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/payments?reference=${reference}`;

    const payment = await prisma.payment.create({
      data: {
        userId: targetUserId,
        enrollmentId: resolvedEnrollmentId,
        programId: parsed.data.programId,
        provider: parsed.data.provider,
        status: PaymentStatus.PENDING,
        amount: finalAmount,
        currency: parsed.data.currency,
        reference,
        billingMonth: new Date(parsed.data.billingMonth),
        discountCodeId: resolvedDiscountCodeId,
        metadata: {
          initializedVia: "api",
          ...(parsed.data.wardId ? { paidByParentId: session.user.id } : {}),
          ...(resolvedDiscountCodeId ? { discountCode: parsed.data.discountCode, originalAmount: parsed.data.amount } : {}),
        },
      },
    });

    let authorizationUrl = `${callbackUrl}&mock=true`;
    let accessCode: string | undefined;

    if (parsed.data.provider === "PAYSTACK" && !process.env.PAYSTACK_SECRET_KEY) {
      authorizationUrl = `${callbackUrl}&mock=true`;
    } else {
      const gateway = getPaymentGateway(parsed.data.provider);
      const initialized = await gateway.initialize({
        email: user.email,
        amount: finalAmount,
        currency: parsed.data.currency,
        reference,
        callbackUrl,
      });
      authorizationUrl = initialized.authorizationUrl;
      accessCode = initialized.accessCode;
    }

    await trackEvent({
      userId: session.user.id,
      organizationId: user.organizationId,
      eventType: "payment",
      eventName: "payment_initialized",
      payload: {
        reference: payment.reference,
        provider: payment.provider,
        amount: payment.amount,
        wardId: parsed.data.wardId,
      },
    });

    return ok(
      {
        payment: {
          id: payment.id,
          reference: payment.reference,
          status: payment.status,
          amount: Number(payment.amount),
          currency: payment.currency,
          provider: payment.provider,
        },
        authorizationUrl,
        accessCode,
      },
      201,
    );
  } catch (error) {
    return fail("Could not initialize payment.", 500, error instanceof Error ? error.message : error);
  }
}

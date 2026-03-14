import { PaymentStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { batchPaymentSchema } from "@/lib/validators";
import { getPaymentGateway } from "@/lib/payments/provider";
import { trackEvent } from "@/lib/analytics";

function generatePaymentReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAT-${stamp}-${random}`;
}

function generateBatchReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAT-BATCH-${stamp}-${random}`;
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const isAdmin =
    session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  const isParent = session.user.role === UserRole.PARENT;

  if (!isParent && !isAdmin) {
    return fail("Only parents can use batch checkout.", 403);
  }

  try {
    const body = await request.json();
    const parsed = batchPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid batch payment payload.", 400, parsed.error.flatten());
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, organizationId: true },
    });
    if (!user) return fail("User not found.", 404);

    const batchReference = generateBatchReference();
    const createdPayments: { id: string; reference: string }[] = [];
    let totalAmount = 0;
    const currency = parsed.data.items[0]?.currency ?? "NGN";

    for (const item of parsed.data.items) {
      // Validate parent-child link (skip check for admins)
      if (isParent) {
        const link = await prisma.parentStudent.findUnique({
          where: { parentId_childId: { parentId: session.user.id, childId: item.wardId } },
          select: { childId: true },
        });
        if (!link) {
          return fail(`Student is not linked to your account.`, 403);
        }
      }

      // Validate program exists
      const program = await prisma.program.findUnique({
        where: { id: item.programId },
        select: { id: true },
      });
      if (!program) return fail(`Program not found.`, 404);

      // Resolve or auto-create enrollment
      const existingEnrollment = await prisma.enrollment.findUnique({
        where: { userId_programId: { userId: item.wardId, programId: item.programId } },
        select: { id: true },
      });
      const enrollmentId =
        existingEnrollment?.id ??
        (
          await prisma.enrollment.create({
            data: { userId: item.wardId, programId: item.programId },
            select: { id: true },
          })
        ).id;

      // Check for duplicate payment
      const billingMonthDate = new Date(item.billingMonth);
      const duplicate = await prisma.payment.findFirst({
        where: {
          userId: item.wardId,
          programId: item.programId,
          billingMonth: billingMonthDate,
          status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
        },
        select: { id: true, status: true },
      });
      if (duplicate) {
        return fail(
          duplicate.status === PaymentStatus.SUCCESS
            ? "A payment for this billing month has already been made."
            : "A pending payment already exists for this billing month.",
          409,
        );
      }

      // Validate discount code if provided for this item
      let resolvedDiscountCodeId: string | null = null;
      let finalAmount = item.amount;

      if (item.discountCode) {
        const dc = await prisma.discountCode.findUnique({
          where: { code: item.discountCode },
        });

        if (!dc || !dc.isActive) return fail(`Discount code "${item.discountCode}" is invalid or inactive.`, 422);
        if (dc.expiresAt && dc.expiresAt < new Date()) return fail(`Discount code "${item.discountCode}" has expired.`, 422);
        if (dc.maxUses !== null && dc.usedCount >= dc.maxUses) return fail(`Discount code "${item.discountCode}" has reached its usage limit.`, 422);
        if (dc.programId && dc.programId !== item.programId) return fail(`Discount code "${item.discountCode}" is not valid for the selected program.`, 422);

        const pct = Number(dc.discountPercent);
        finalAmount = Math.round(item.amount * (1 - pct / 100));
        resolvedDiscountCodeId = dc.id;
      }

      const reference = generatePaymentReference();
      const payment = await prisma.payment.create({
        data: {
          userId: item.wardId,
          enrollmentId,
          programId: item.programId,
          provider: parsed.data.provider,
          status: PaymentStatus.PENDING,
          amount: finalAmount,
          currency: item.currency,
          reference,
          billingMonth: billingMonthDate,
          discountCodeId: resolvedDiscountCodeId,
          metadata: {
            batchReference,
            paidByParentId: session.user.id,
            ...(resolvedDiscountCodeId ? { discountCode: item.discountCode, originalAmount: item.amount } : {}),
          },
        },
        select: { id: true, reference: true },
      });

      createdPayments.push(payment);
      totalAmount += finalAmount;
    }

    // Initialize a single Paystack transaction for the total
    const callbackUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/dashboard/payments?batchRef=${batchReference}`;
    let authorizationUrl = `${callbackUrl}&mock=true`;
    let accessCode: string | undefined;

    if (parsed.data.provider === "PAYSTACK" && process.env.PAYSTACK_SECRET_KEY) {
      const gateway = getPaymentGateway(parsed.data.provider);
      const initialized = await gateway.initialize({
        email: user.email,
        amount: totalAmount,
        currency,
        reference: batchReference,
        callbackUrl,
      });
      authorizationUrl = initialized.authorizationUrl;
      accessCode = initialized.accessCode;
    }

    await trackEvent({
      userId: session.user.id,
      organizationId: user.organizationId,
      eventType: "payment",
      eventName: "batch_payment_initialized",
      payload: {
        batchReference,
        itemCount: createdPayments.length,
        totalAmount,
      },
    });

    return ok(
      {
        batchReference,
        paymentCount: createdPayments.length,
        totalAmount,
        currency,
        authorizationUrl,
        accessCode,
      },
      201,
    );
  } catch (error) {
    return fail(
      "Could not initialize batch payment.",
      500,
      error instanceof Error ? error.message : error,
    );
  }
}
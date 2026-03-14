import { PaymentStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSchema } from "@/lib/validators";
import { getPaymentGateway } from "@/lib/payments/provider";
import { trackEvent } from "@/lib/analytics";

function generateReceiptNumber() {
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAT-RCP-${yyyy}${mm}${dd}-${random}`;
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  try {
    const body = await request.json();
    const parsed = verifyPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid verification payload.", 400, parsed.error.flatten());
    }

    const payment = await prisma.payment.findUnique({
      where: { reference: parsed.data.reference },
      include: {
        user: {
          select: { id: true, organizationId: true },
        },
      },
    });

    if (!payment) {
      return fail("Payment not found.", 404);
    }

    const canVerify =
      payment.userId === session.user.id ||
      session.user.role === UserRole.SUPER_ADMIN ||
      session.user.role === UserRole.ADMIN;

    if (!canVerify) {
      return fail("Forbidden", 403);
    }

    let verification: {
      success: boolean;
      status: string;
      paidAt?: Date;
      channel?: string;
      amount?: number;
      currency?: string;
      raw?: unknown;
    };

    if (parsed.data.provider === "PAYSTACK" && !process.env.PAYSTACK_SECRET_KEY) {
      verification = {
        success: true,
        status: "success",
        paidAt: new Date(),
        amount: Number(payment.amount),
        currency: payment.currency,
        channel: "mock",
      };
    } else {
      const gateway = getPaymentGateway(parsed.data.provider);
      verification = await gateway.verify(parsed.data.reference);
    }

    const status = verification.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status,
        verifiedAt: verification.paidAt ?? new Date(),
        channel: verification.channel,
        metadata: {
          ...(typeof payment.metadata === "object" && payment.metadata !== null ? payment.metadata : {}),
          verification: verification.raw ?? verification.status,
        },
      },
    });

    if (verification.success) {
      await prisma.paymentReceipt.upsert({
        where: { paymentId: payment.id },
        update: {
          issuedToId: payment.userId,
          issuedById:
            session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN
              ? session.user.id
              : null,
        },
        create: {
          paymentId: payment.id,
          receiptNumber: generateReceiptNumber(),
          issuedToId: payment.userId,
          issuedById:
            session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN
              ? session.user.id
              : null,
        },
      });
    }

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "payment",
      eventName: verification.success ? "payment_verified" : "payment_failed",
      payload: { reference: payment.reference, status },
    });

    return ok({
      payment: {
        id: updatedPayment.id,
        reference: updatedPayment.reference,
        status: updatedPayment.status,
        amount: Number(updatedPayment.amount),
        currency: updatedPayment.currency,
      },
      verification,
    });
  } catch (error) {
    return fail("Could not verify payment.", 500, error instanceof Error ? error.message : error);
  }
}

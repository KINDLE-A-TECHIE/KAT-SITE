import { PaymentStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyBatchPaymentSchema } from "@/lib/validators";
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
    const parsed = verifyBatchPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid verification payload.", 400, parsed.error.flatten());
    }

    // Find all payments belonging to this batch
    const payments = await prisma.payment.findMany({
      where: {
        metadata: {
          path: ["batchReference"],
          equals: parsed.data.batchReference,
        },
      },
    });

    if (payments.length === 0) {
      return fail("No payments found for this batch reference.", 404);
    }

    // Access control: must be the initiating parent or an admin
    const isAdmin =
      session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;

    if (!isAdmin) {
      const allBelongToUser = payments.every((p) => {
        const meta =
          typeof p.metadata === "object" && p.metadata !== null
            ? (p.metadata as Record<string, unknown>)
            : {};
        return meta.paidByParentId === session.user.id;
      });
      if (!allBelongToUser) {
        return fail("Forbidden", 403);
      }
    }

    // Verify the batch transaction with the payment gateway
    let verification: {
      success: boolean;
      status: string;
      paidAt?: Date;
      channel?: string;
      raw?: unknown;
    };

    if (parsed.data.provider === "PAYSTACK" && !process.env.PAYSTACK_SECRET_KEY) {
      verification = { success: true, status: "success", paidAt: new Date(), channel: "mock" };
    } else {
      const gateway = getPaymentGateway(parsed.data.provider);
      verification = await gateway.verify(parsed.data.batchReference);
    }

    const status = verification.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;

    // Update all payments in the batch
    const updatedPayments = await Promise.all(
      payments.map((p) =>
        prisma.payment.update({
          where: { id: p.id },
          data: {
            status,
            verifiedAt: verification.paidAt ?? new Date(),
            channel: verification.channel,
            metadata: {
              ...(typeof p.metadata === "object" && p.metadata !== null
                ? (p.metadata as Record<string, unknown>)
                : {}),
              verification: verification.raw ?? verification.status,
            },
          },
        }),
      ),
    );

    // Issue receipts for all successful payments
    const receipts: { id: string; receiptNumber: string }[] = [];
    if (verification.success) {
      for (const payment of updatedPayments) {
        const receipt = await prisma.paymentReceipt.upsert({
          where: { paymentId: payment.id },
          update: {
            issuedToId: payment.userId,
            issuedById: isAdmin ? session.user.id : null,
          },
          create: {
            paymentId: payment.id,
            receiptNumber: generateReceiptNumber(),
            issuedToId: payment.userId,
            issuedById: isAdmin ? session.user.id : null,
          },
          select: { id: true, receiptNumber: true },
        });
        receipts.push(receipt);
      }
    }

    await trackEvent({
      userId: session.user.id,
      organizationId: session.user.organizationId,
      eventType: "payment",
      eventName: verification.success ? "batch_payment_verified" : "batch_payment_failed",
      payload: {
        batchReference: parsed.data.batchReference,
        paymentCount: payments.length,
        status,
      },
    });

    return ok({
      batchReference: parsed.data.batchReference,
      status,
      paymentCount: updatedPayments.length,
      receipts,
    });
  } catch (error) {
    return fail(
      "Could not verify batch payment.",
      500,
      error instanceof Error ? error.message : error,
    );
  }
}
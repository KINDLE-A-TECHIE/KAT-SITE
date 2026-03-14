import { z } from "zod";
import { type Prisma, PaymentStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAYSTACK_API_BASE = "https://api.paystack.co";

const refundSchema = z.object({
  paymentId: z.string().cuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const isAdmin =
    session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  if (!isAdmin) {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = refundSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid refund payload.", 400, parsed.error.flatten());
    }

    const payment = await prisma.payment.findUnique({
      where: { id: parsed.data.paymentId },
    });

    if (!payment) {
      return fail("Payment not found.", 404);
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      return fail("Only successful payments can be refunded.", 400);
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return fail("Payment provider is not configured.", 500);
    }

    const refundResponse = await fetch(`${PAYSTACK_API_BASE}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: payment.reference,
        ...(parsed.data.reason ? { merchant_note: parsed.data.reason } : {}),
      }),
    });

    const refundPayload = (await refundResponse.json()) as {
      status: boolean;
      message: string;
      data?: unknown;
    };

    if (!refundResponse.ok || !refundPayload.status) {
      return fail("Refund request rejected by payment provider.", 502, refundPayload.message);
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        metadata: {
          ...(typeof payment.metadata === "object" && payment.metadata !== null
            ? (payment.metadata as Record<string, unknown>)
            : {}),
          refund: {
            initiatedAt: new Date().toISOString(),
            initiatedBy: session.user.id,
            reason: parsed.data.reason ?? null,
            raw: refundPayload.data as Prisma.InputJsonValue,
          },
        },
      },
    });

    return ok({
      payment: {
        id: updatedPayment.id,
        reference: updatedPayment.reference,
        status: updatedPayment.status,
        amount: Number(updatedPayment.amount),
        currency: updatedPayment.currency,
      },
    });
  } catch (error) {
    return fail("Could not process refund.", 500, error instanceof Error ? error.message : error);
  }
}

import crypto from "crypto";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Disable body parsing so we can read the raw body for HMAC verification.
export const dynamic = "force-dynamic";

type PaystackChargeEvent = {
  event: string;
  data: {
    reference?: string;
    status?: string;
    paid_at?: string;
    channel?: string;
    amount?: number;
    currency?: string;
  };
};

function generateReceiptNumber() {
  const date = new Date();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KAT-RCP-${yyyy}${mm}${dd}-${random}`;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  // Verify HMAC-SHA512 signature. Use PAYSTACK_WEBHOOK_SECRET if set,
  // otherwise fall back to the secret key (same value Paystack uses by default).
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY;

  if (!secret) {
    console.error("[webhook] PAYSTACK_WEBHOOK_SECRET is not configured.");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (signature !== expected) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: PaystackChargeEvent;
  try {
    event = JSON.parse(rawBody) as PaystackChargeEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const ref = event.data.reference;

  if (event.event === "charge.success" && ref) {
    const payment = await prisma.payment.findUnique({
      where: { reference: ref },
    });

    if (payment && payment.status === PaymentStatus.PENDING) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCESS,
          verifiedAt: event.data.paid_at ? new Date(event.data.paid_at) : new Date(),
          channel: event.data.channel,
          metadata: {
            ...(typeof payment.metadata === "object" && payment.metadata !== null
              ? (payment.metadata as Record<string, unknown>)
              : {}),
            webhook: { status: event.data.status, channel: event.data.channel },
          },
        },
      });

      await prisma.paymentReceipt.upsert({
        where: { paymentId: payment.id },
        update: {},
        create: {
          paymentId: payment.id,
          receiptNumber: generateReceiptNumber(),
          issuedToId: payment.userId,
        },
      });
    }
  }

  if (event.event === "refund.processed" && ref) {
    const payment = await prisma.payment.findUnique({
      where: { reference: ref },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          metadata: {
            ...(typeof payment.metadata === "object" && payment.metadata !== null
              ? (payment.metadata as Record<string, unknown>)
              : {}),
            refund: { processedAt: new Date().toISOString(), status: event.data.status },
          },
        },
      });
    }
  }

  // Always return 200 — Paystack will retry on non-2xx responses.
  return new Response("OK", { status: 200 });
}

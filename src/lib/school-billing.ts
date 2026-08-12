import "server-only";
import { SchoolInvoiceStatus, SchoolLicenseStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Net invoice amount after the school's concession. Pure and rounded to two decimals (kobo).
 *
 *   list = seatCount x pricePerSeat
 *   net  = list x (1 - discountPercent/100), floored at 0
 *
 * discountPercent is clamped to 0..100 defensively. A 100% concession nets 0, which the billing
 * route treats as a sponsored/free term (no Paystack; the licence is activated directly).
 */
export function computeInvoiceAmount(
  seatCount: number,
  pricePerSeat: number,
  discountPercent: number,
): { list: number; discountPercent: number; amount: number } {
  const pct = Math.min(100, Math.max(0, discountPercent));
  const list = seatCount * pricePerSeat;
  const net = Math.max(0, list * (1 - pct / 100));
  return {
    list: Number(list.toFixed(2)),
    discountPercent: pct,
    amount: Number(net.toFixed(2)),
  };
}

/**
 * School billing, invoice-based, per seat, per term. NOT the B2C monthly subscription.
 *
 * The activation below is shared by BOTH the Paystack webhook and the verify-on-return
 * endpoint, deliberately: two copies of "what PAID means" would eventually disagree,
 * and the disagreement would be about whether a school has access.
 */

/**
 * Mark an invoice PAID and activate its term's licence.
 *
 * IDEMPOTENT, this is not optional. Paystack retries webhooks, and the verify
 * endpoint can fire for the same reference the webhook already handled. Running twice
 * must not double-activate, double-count seats, or reset a term's usage.
 *
 * Returns true if this call performed the activation, false if it was already done.
 */
export async function markInvoicePaidAndActivate(paystackRef: string): Promise<boolean> {
  const invoice = await prisma.schoolInvoice.findUnique({
    where: { paystackRef },
    select: {
      id: true,
      schoolId: true,
      sessionLabel: true,
      termNumber: true,
      startsAt: true,
      seatCount: true,
      status: true,
      school: { select: { pricePerSeat: true } },
    },
  });

  if (!invoice) return false; // not a school invoice, the caller falls through to B2C
  if (invoice.status === SchoolInvoiceStatus.PAID) return false; // already done
  if (invoice.status === SchoolInvoiceStatus.VOID) return false; // refuse to revive a voided invoice

  await prisma.$transaction(async (tx) => {
    await tx.schoolInvoice.update({
      where: { id: invoice.id },
      data: { status: SchoolInvoiceStatus.PAID },
    });

    // @@unique([schoolId, sessionLabel, termNumber]), one licence per term, so this upsert is the
    // "renew or create" path. seatsUsed is NOT touched on update: a renewal or a seat top-up must
    // not wipe the students already occupying seats this term. startsAt carries the admin-entered
    // start so the term's 15-week window is anchored (null until the billing UI captures it).
    await tx.schoolLicense.upsert({
      where: {
        schoolId_sessionLabel_termNumber: {
          schoolId: invoice.schoolId,
          sessionLabel: invoice.sessionLabel,
          termNumber: invoice.termNumber,
        },
      },
      update: {
        seatLimit: invoice.seatCount,
        pricePerSeat: invoice.school.pricePerSeat,
        status: SchoolLicenseStatus.ACTIVE,
        ...(invoice.startsAt ? { startsAt: invoice.startsAt } : {}),
      },
      create: {
        schoolId: invoice.schoolId,
        sessionLabel: invoice.sessionLabel,
        termNumber: invoice.termNumber,
        startsAt: invoice.startsAt,
        seatLimit: invoice.seatCount,
        seatsUsed: 0,
        pricePerSeat: invoice.school.pricePerSeat,
        status: SchoolLicenseStatus.ACTIVE,
      },
    });
  });

  return true;
}

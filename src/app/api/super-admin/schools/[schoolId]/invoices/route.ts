import { SchoolInvoiceStatus, SchoolInvoicePaymentMethod, UserRole } from "@prisma/client";
import { fail, ok, serverError } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolInvoiceManualCreateSchema } from "@/lib/validators";
import { parseTerm, formatTerm } from "@/lib/school-term";
import { generateInvoiceReference } from "@/lib/payments/receipt";
import { computeInvoiceAmount, markInvoicePaidAndActivate } from "@/lib/school-billing";
import { trackEvent } from "@/lib/analytics";

/**
 * POST /api/super-admin/schools/[schoolId]/invoices
 *
 * MANUAL LICENSING, raise-and-settle in one step. For a school that paid by bank transfer BEFORE any
 * invoice existed (it does not self-serve billing). The super-admin enters the term and seat count;
 * the amount is still computed server-side from the school's agreed price and concession (never taken
 * from the request), the invoice is created, and it is marked PAID + the licence activated at once.
 *
 * SUPER_ADMIN only. Mirrors the guards on the school self-serve POST (suspension, price set, one open
 * invoice per term, cannot buy fewer seats than are already in use).
 */
export async function POST(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { schoolId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = schoolInvoiceManualCreateSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const { term: termInput, seatCount, note } = parsed.data;
  const { sessionLabel, termNumber } = parseTerm(termInput);
  const termLabel = formatTerm(sessionLabel, termNumber);

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { pricePerSeat: true, discountPercent: true, discountReason: true, suspendedAt: true },
    });
    if (!school) return fail("School not found.", 404);
    if (school.suspendedAt) {
      return fail("This school's billing is suspended. Resume it before raising an invoice.", 403);
    }

    const pricePerSeat = Number(school.pricePerSeat);
    const discountPercent = Number(school.discountPercent);
    if (pricePerSeat <= 0 && discountPercent < 100) {
      return fail("No seat price is set for this school. Set its price or a full concession first.", 422);
    }

    const openInvoice = await prisma.schoolInvoice.findFirst({
      where: { schoolId, sessionLabel, termNumber, status: SchoolInvoiceStatus.PENDING },
      select: { id: true },
    });
    if (openInvoice) {
      return fail(`There is already an unpaid invoice for ${termLabel}. Settle or void it first.`, 409);
    }

    const license = await prisma.schoolLicense.findUnique({
      where: { schoolId_sessionLabel_termNumber: { schoolId, sessionLabel, termNumber } },
      select: { seatsUsed: true },
    });
    if (license && seatCount < license.seatsUsed) {
      return fail(
        `${termLabel} already has ${license.seatsUsed} seats in use, so you cannot license only ${seatCount}.`,
        422,
      );
    }

    const { amount } = computeInvoiceAmount(seatCount, pricePerSeat, discountPercent);
    const paystackRef = generateInvoiceReference();
    // A net-zero invoice is really a sponsorship, not a payment; label it honestly.
    const method = amount <= 0 ? SchoolInvoicePaymentMethod.SPONSORED : SchoolInvoicePaymentMethod.BANK_TRANSFER;

    const invoice = await prisma.schoolInvoice.create({
      data: {
        schoolId,
        sessionLabel,
        termNumber,
        seatCount,
        amount,
        discountPercent,
        discountReason: school.discountReason,
        status: SchoolInvoiceStatus.PENDING,
        paystackRef,
      },
      select: { id: true, sessionLabel: true, termNumber: true, seatCount: true, amount: true, discountPercent: true },
    });

    await markInvoicePaidAndActivate(paystackRef, { method, note: note && note.length > 0 ? note : null });

    await trackEvent({
      userId: session.user.id,
      eventType: "admin",
      eventName: "school_invoice_manual_created",
      payload: { schoolId, sessionLabel, termNumber, seatCount, amount, method },
    });

    return ok(
      {
        invoice: { ...invoice, term: termLabel, amount: Number(invoice.amount), discountPercent: Number(invoice.discountPercent), paid: true },
      },
      201,
    );
  } catch (error) {
    return serverError(error, "Could not record the payment.");
  }
}

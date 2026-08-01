import { PaymentProvider, SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { schoolInvoiceVerifySchema } from "@/lib/validators";
import { formatTerm } from "@/lib/school-term";
import { getPaymentGateway } from "@/lib/payments/provider";
import { markInvoicePaidAndActivate } from "@/lib/school-billing";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/school/billing/verify, verify-on-return safety net.
 *
 * The webhook is authoritative, but it can be delayed or dropped. When the admin comes
 * back from Paystack we re-ask Paystack directly and apply the SAME idempotent
 * activation, so a school is never left paid-but-locked-out because a webhook was late.
 *
 * It is safe to call this even when the webhook already ran: markInvoicePaidAndActivate
 * is idempotent, so the second call is a no-op rather than a double activation.
 *
 * TRUST: the payment status comes from Paystack's API, never from the client, the
 * request supplies only a reference, and that reference must belong to THIS school.
 */
export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolInvoiceVerifySchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid payload.", 400, parsed.error.flatten());
  }
  const { reference } = parsed.data;

  try {
    // TENANT ISOLATION: the reference must be an invoice of the caller's own school,
    // otherwise an admin could verify (and activate) another school's invoice.
    const invoice = await prisma.schoolInvoice.findFirst({
      where: { paystackRef: reference, schoolId },
      select: { id: true, status: true, sessionLabel: true, termNumber: true },
    });
    if (!invoice) return fail("Invoice not found.", 404);

    const gateway = getPaymentGateway(PaymentProvider.PAYSTACK);

    // A gateway failure is NOT a server error from the caller's point of view. Paystack
    // does not know a reference for an abandoned checkout, and a transient outage is
    // not the admin's problem, in both cases the honest answer is "not confirmed yet",
    // and the webhook (which is authoritative) will still activate the term when the
    // payment clears. Answering 500 here would only spam Sentry and alarm the admin.
    let result;
    try {
      result = await gateway.verify(reference);
    } catch (error) {
      captureError(error);
      return ok({ paid: false, status: "unverified", invoiceStatus: invoice.status });
    }

    if (!result.success) {
      return ok({ paid: false, status: result.status, invoiceStatus: invoice.status });
    }

    const activated = await markInvoicePaidAndActivate(reference);

    return ok({
      paid: true,
      activated, // false when the webhook had already done it, not an error
      term: formatTerm(invoice.sessionLabel, invoice.termNumber),
    });
  } catch (error) {
    captureError(error);
    return fail("Could not verify the payment.", 500);
  }
}

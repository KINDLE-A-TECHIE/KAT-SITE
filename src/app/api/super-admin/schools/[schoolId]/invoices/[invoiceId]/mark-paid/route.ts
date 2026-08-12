import { SchoolInvoiceStatus, SchoolInvoicePaymentMethod, UserRole } from "@prisma/client";
import { fail, ok, serverError } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolInvoiceMarkPaidSchema } from "@/lib/validators";
import { markInvoicePaidAndActivate } from "@/lib/school-billing";
import { trackEvent } from "@/lib/analytics";

/**
 * POST /api/super-admin/schools/[schoolId]/invoices/[invoiceId]/mark-paid
 *
 * MANUAL LICENSING. A school paid into KAT's bank account, so there is no Paystack event to activate
 * its term. A super-admin confirms the transfer here, which marks the PENDING invoice PAID and
 * activates the term's licence, reusing the exact same idempotent activation the webhook uses.
 *
 * SUPER_ADMIN only, deliberately: a school marking its own invoice paid would be self-activation for
 * free. Only a pending invoice can be settled (a paid one is already done; a void one must not revive).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ schoolId: string; invoiceId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { schoolId, invoiceId } = await params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is fine, the note is optional.
  }
  const parsed = schoolInvoiceMarkPaidSchema.safeParse(body ?? {});
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  try {
    // Scope to the school in the path so one school's invoice id cannot settle another's.
    const invoice = await prisma.schoolInvoice.findFirst({
      where: { id: invoiceId, schoolId },
      select: { paystackRef: true, status: true },
    });
    if (!invoice) return fail("Invoice not found.", 404);
    if (invoice.status !== SchoolInvoiceStatus.PENDING) {
      return fail(`This invoice is ${invoice.status.toLowerCase()}, only a pending invoice can be marked paid.`, 409);
    }

    const activated = await markInvoicePaidAndActivate(invoice.paystackRef, {
      method: SchoolInvoicePaymentMethod.BANK_TRANSFER,
      note: parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : null,
    });
    if (!activated) {
      // Lost a race with the webhook/another admin. Not an error, the term is active either way.
      return ok({ alreadyPaid: true });
    }

    await trackEvent({
      userId: session.user.id,
      eventType: "admin",
      eventName: "school_invoice_marked_paid",
      payload: { schoolId, invoiceId, method: "BANK_TRANSFER" },
    });

    return ok({ marked: true });
  } catch (error) {
    return serverError(error, "Could not mark the invoice paid.");
  }
}

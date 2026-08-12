import { PaymentProvider, SchoolInvoiceStatus, SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { schoolInvoiceCreateSchema } from "@/lib/validators";
import { parseTerm, formatTerm } from "@/lib/school-term";
import { getPaymentGateway } from "@/lib/payments/provider";
import { generateInvoiceReference } from "@/lib/payments/receipt";
import { SCHOOL_HOST, isSchoolHost } from "@/lib/school-host";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/sentry";
import { computeInvoiceAmount, markInvoicePaidAndActivate } from "@/lib/school-billing";

/**
 * School billing, invoice per term, per seat. SCHOOL_ADMIN only.
 *
 * NEVER licence-gated: when a licence lapses the admin must still reach billing to
 * fix it. Gating this would be a deadlock, the school could never pay its way back in.
 */

const CURRENCY = "NGN";

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

// GET /api/school/billing/invoices, this school's invoices + licences.
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  try {
    const [school, invoices, licenses] = await Promise.all([
      prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true, pricePerSeat: true, discountPercent: true, discountReason: true },
      }),
      prisma.schoolInvoice.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          sessionLabel: true,
          termNumber: true,
          seatCount: true,
          amount: true,
          discountPercent: true,
          discountReason: true,
          status: true,
          paystackRef: true,
          createdAt: true,
        },
      }),
      prisma.schoolLicense.findMany({
        where: { schoolId },
        orderBy: [{ sessionLabel: "desc" }, { termNumber: "desc" }],
        select: { sessionLabel: true, termNumber: true, startsAt: true, status: true, seatLimit: true, seatsUsed: true },
      }),
    ]);

    return ok({
      school: {
        name: school?.name ?? "",
        pricePerSeat: Number(school?.pricePerSeat ?? 0),
        discountPercent: Number(school?.discountPercent ?? 0),
        discountReason: school?.discountReason ?? null,
      },
      // Compose a `term` label at the boundary so the billing UI keeps reading one field.
      invoices: invoices.map((i) => ({
        ...i,
        term: formatTerm(i.sessionLabel, i.termNumber),
        amount: Number(i.amount),
        discountPercent: Number(i.discountPercent),
      })),
      licenses: licenses.map((l) => ({ ...l, term: formatTerm(l.sessionLabel, l.termNumber) })),
    });
  } catch (error) {
    captureError(error);
    return fail("Could not load billing.", 500);
  }
}

// POST /api/school/billing/invoices, confirm seats for a term, get a payment link.
export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  const session = await getServerAuthSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolInvoiceCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid invoice payload.", 400, parsed.error.flatten());
  }
  const { term: termInput, seatCount } = parsed.data;
  // A term is entered as free text ("2025/2026 Term 1") and stored structured. `termLabel` is the
  // canonical display form used in messages and the response.
  const { sessionLabel, termNumber } = parseTerm(termInput);
  const termLabel = formatTerm(sessionLabel, termNumber);

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, pricePerSeat: true, discountPercent: true, discountReason: true, suspendedAt: true },
    });
    if (!school) return fail("School not found.", 404);

    // Billing suspension (super-admin). A commercial pause: no new invoices or seat purchases while
    // suspended. Existing paid, in-window licences are untouched, pupils are not cut off mid-term.
    if (school.suspendedAt) {
      return fail("This school's billing is suspended. Please contact KAT to resume.", 403);
    }

    const pricePerSeat = Number(school.pricePerSeat);
    const discountPercent = Number(school.discountPercent);
    // A price is required UNLESS the concession is a full (100%) sponsorship: a fully-sponsored pilot
    // may have no agreed list price yet and still gets a free, activated licence below.
    if (pricePerSeat <= 0 && discountPercent < 100) {
      return fail(
        "No seat price has been set for your school. Contact KAT to agree your pricing.",
        422,
      );
    }

    // One open invoice per term, otherwise an admin could stack several and pay the
    // cheapest, or race two activations for the same term.
    const openInvoice = await prisma.schoolInvoice.findFirst({
      where: { schoolId, sessionLabel, termNumber, status: SchoolInvoiceStatus.PENDING },
      select: { id: true, paystackRef: true },
    });
    if (openInvoice) {
      return fail(
        `There is already an unpaid invoice for ${termLabel}. Pay or void it before raising another.`,
        409,
      );
    }

    // You cannot buy fewer seats than are already occupied this term, that would
    // instantly put the school OVER_SEATED and lock its own students out.
    const license = await prisma.schoolLicense.findUnique({
      where: { schoolId_sessionLabel_termNumber: { schoolId, sessionLabel, termNumber } },
      select: { seatsUsed: true },
    });
    if (license && seatCount < license.seatsUsed) {
      return fail(
        `${termLabel} already has ${license.seatsUsed} seats in use, so you cannot buy only ${seatCount}.`,
        422,
      );
    }

    // THE AMOUNT IS COMPUTED HERE, never taken from the request. The concession also comes off the
    // SCHOOL record (super-admin-set), never the request, so a school cannot discount itself.
    const { amount } = computeInvoiceAmount(seatCount, pricePerSeat, discountPercent);
    const paystackRef = generateInvoiceReference();

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
      select: {
        id: true,
        sessionLabel: true,
        termNumber: true,
        seatCount: true,
        amount: true,
        discountPercent: true,
        discountReason: true,
        status: true,
        paystackRef: true,
      },
    });

    // FREE / SPONSORED TERM: a net-zero invoice cannot go through Paystack (you cannot charge NGN 0).
    // Mark it PAID and activate the term's licence immediately, reusing the exact same activation the
    // webhook uses (idempotent). The school gets access with no payment step.
    if (amount <= 0) {
      await markInvoicePaidAndActivate(paystackRef);
      await trackEvent({
        userId: session?.user?.id,
        eventType: "admin",
        eventName: "school_invoice_sponsored",
        payload: { schoolId, sessionLabel, termNumber, seatCount, discountPercent },
      });
      return ok(
        {
          invoice: { ...invoice, term: termLabel, amount: Number(invoice.amount), discountPercent: Number(invoice.discountPercent), paid: true },
          authorizationUrl: null,
        },
        201,
      );
    }

    // Return the admin to the SCHOOL host they paid from, NOT the B2C apex (NEXTAUTH_URL).
    // Their school session cookie lives on the school host, so landing on the apex /admin
    // finds no session and bounces them to the B2C /login. Prefer the request's own host,
    // fall back to the configured SCHOOL_HOST if it is somehow not a school host.
    const reqHost = request.headers.get("host");
    const proto =
      request.headers.get("x-forwarded-proto") ??
      (process.env.NEXTAUTH_URL?.startsWith("https") ? "https" : "http");
    const callbackHost = isSchoolHost(reqHost) ? reqHost! : SCHOOL_HOST;
    const callbackUrl = `${proto}://${callbackHost}/admin/billing?reference=${paystackRef}`;

    // Reuse the existing gateway. The reference we generated is what the webhook will
    // look the invoice up by.
    let authorizationUrl: string | null = null;
    try {
      const gateway = getPaymentGateway(PaymentProvider.PAYSTACK);
      const initialized = await gateway.initialize({
        email: session!.user.email ?? `billing+${schoolId}@kindleatechie.com`,
        amount,
        currency: CURRENCY,
        reference: paystackRef,
        callbackUrl,
      });
      authorizationUrl = initialized.authorizationUrl;
    } catch (error) {
      // The invoice stands even if checkout could not be initialized, the admin can
      // retry payment. Losing the invoice would lose the audit trail.
      captureError(error);
    }

    await trackEvent({
      userId: session?.user?.id,
      eventType: "admin",
      eventName: "school_invoice_created",
      payload: { schoolId, sessionLabel, termNumber, seatCount, amount },
    });

    return ok(
      {
        invoice: {
          ...invoice,
          term: termLabel,
          amount: Number(invoice.amount),
          discountPercent: Number(invoice.discountPercent),
        },
        authorizationUrl,
      },
      201,
    );
  } catch (error) {
    captureError(error);
    return fail("Could not create the invoice.", 500);
  }
}

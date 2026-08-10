import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolSeatPriceUpdateSchema } from "@/lib/validators";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/sentry";

function ensureSuperAdmin(role: UserRole) {
  if (role !== UserRole.SUPER_ADMIN) {
    throw new Error("Forbidden");
  }
}

/**
 * PATCH /api/super-admin/schools/[schoolId]
 *
 * Update a school's negotiated per-seat price after provisioning. SUPER_ADMIN only: a school must
 * never be able to price itself, or it would invoice itself a token amount and self-issue a licence
 * (the same reason `pricePerSeat` is absent from `schoolInvoiceCreateSchema`).
 *
 * FORWARD-ONLY, by design:
 *  - New invoices are computed at the new price (POST /api/school/billing/invoices reads it live).
 *  - Existing `SchoolLicense`s keep the price they SNAPSHOTTED at activation; past terms are never
 *    repriced.
 *  - A PENDING invoice was already computed at the OLD price and stands until it is paid or voided.
 *    To bill a term at the new price, void the open invoice and raise a fresh one.
 *  - Setting 0 suspends invoicing: the billing route then 422s until a price is set again.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  try {
    ensureSuperAdmin(session.user.role);
  } catch {
    return fail("Forbidden", 403);
  }

  const { schoolId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolSeatPriceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid pricing payload.", 400, parsed.error.flatten());
  }
  const { pricePerSeat } = parsed.data;

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });
    if (!school) return fail("School not found.", 404);

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data: { pricePerSeat },
      select: { id: true, name: true, pricePerSeat: true },
    });

    await trackEvent({
      userId: session.user.id,
      eventType: "admin",
      eventName: "school_price_updated",
      payload: { schoolId, pricePerSeat },
    });

    return ok({
      school: {
        id: updated.id,
        name: updated.name,
        pricePerSeat: Number(updated.pricePerSeat),
      },
    });
  } catch (error) {
    captureError(error);
    return fail("Could not update the seat price.", 500);
  }
}

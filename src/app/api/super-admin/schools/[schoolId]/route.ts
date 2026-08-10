import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolAdminUpdateSchema } from "@/lib/validators";
import { getSchoolDetail } from "@/lib/super-admin-schools";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/sentry";

function ensureSuperAdmin(role: UserRole) {
  if (role !== UserRole.SUPER_ADMIN) {
    throw new Error("Forbidden");
  }
}

/**
 * GET /api/super-admin/schools/[schoolId]
 *
 * One school's licences (per term) and recent invoices, for the super-admin drill-down.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  try {
    ensureSuperAdmin(session.user.role);
  } catch {
    return fail("Forbidden", 403);
  }

  const { schoolId } = await params;

  try {
    const detail = await getSchoolDetail(schoolId);
    if (!detail) return fail("School not found.", 404);
    return ok({ detail });
  } catch (error) {
    captureError(error);
    return fail("Could not load the school.", 500);
  }
}

/**
 * PATCH /api/super-admin/schools/[schoolId]
 *
 * Update a school's negotiated per-seat price and/or its billing suspension. SUPER_ADMIN only: a
 * school must never be able to price or un-suspend itself.
 *
 * PRICE is FORWARD-ONLY: new invoices use the new price, existing `SchoolLicense`s keep the price they
 * SNAPSHOTTED, and a PENDING invoice stands until paid or voided. Setting 0 blocks invoicing.
 *
 * SUSPENSION is a COMMERCIAL pause, not a mid-term access cut: while suspended the billing route
 * refuses new invoices/seat purchases, but pupils already inside a paid, in-window licence keep access
 * until that window expires (the "don't strand pupils" rule). Reversible: set suspended:false to resume.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
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

  const parsed = schoolAdminUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid update payload.", 400, parsed.error.flatten());
  }
  const { pricePerSeat, suspended } = parsed.data;

  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
    if (!school) return fail("School not found.", 404);

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data: {
        ...(pricePerSeat !== undefined ? { pricePerSeat } : {}),
        ...(suspended !== undefined ? { suspendedAt: suspended ? new Date() : null } : {}),
      },
      select: { id: true, name: true, pricePerSeat: true, suspendedAt: true },
    });

    await trackEvent({
      userId: session.user.id,
      eventType: "admin",
      eventName: "school_updated",
      payload: { schoolId, ...(pricePerSeat !== undefined ? { pricePerSeat } : {}), ...(suspended !== undefined ? { suspended } : {}) },
    });

    return ok({
      school: {
        id: updated.id,
        name: updated.name,
        pricePerSeat: Number(updated.pricePerSeat),
        suspendedAt: updated.suspendedAt ? updated.suspendedAt.toISOString() : null,
      },
    });
  } catch (error) {
    captureError(error);
    return fail("Could not update the school.", 500);
  }
}

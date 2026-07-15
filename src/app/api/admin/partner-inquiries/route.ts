import { PartnerType, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { partnerInquiryStatusUpdateSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const VALID_TYPES = new Set<string>(Object.values(PartnerType));

// GET /api/admin/partner-inquiries, list all partner/school leads, newest first.
// Optional ?type= filter (SCHOOL | CORPORATE | GOVERNMENT | OTHER).
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ADMIN_ROLES.includes(session.user.role)) return fail("Forbidden", 403);

  const typeParam = new URL(request.url).searchParams.get("type");
  const typeFilter = typeParam && VALID_TYPES.has(typeParam) ? (typeParam as PartnerType) : undefined;

  try {
    const inquiries = await prisma.partnerInquiry.findMany({
      where: typeFilter ? { type: typeFilter } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return ok({ inquiries });
  } catch (error) {
    captureError(error);
    return fail("Could not load partner inquiries.", 500);
  }
}

// PATCH /api/admin/partner-inquiries, update a lead's triage status.
export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ADMIN_ROLES.includes(session.user.role)) return fail("Forbidden", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = partnerInquiryStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid payload.", 400, parsed.error.flatten());
  }

  try {
    const existing = await prisma.partnerInquiry.findUnique({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    if (!existing) return fail("Inquiry not found.", 404);

    const inquiry = await prisma.partnerInquiry.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

    return ok({ inquiry });
  } catch (error) {
    captureError(error);
    return fail("Could not update inquiry.", 500);
  }
}

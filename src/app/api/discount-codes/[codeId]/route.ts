import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDiscountCodeSchema } from "@/lib/validators";

interface Params { params: Promise<{ codeId: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { codeId } = await params;

  const code = await prisma.discountCode.findFirst({
    where: { id: codeId, organizationId: session.user.organizationId ?? undefined },
  });
  if (!code) return fail("Discount code not found.", 404);

  const body = await request.json();
  const parsed = updateDiscountCodeSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const updated = await prisma.discountCode.update({
    where: { id: codeId },
    data: {
      ...(parsed.data.description     !== undefined && { description: parsed.data.description }),
      ...(parsed.data.discountPercent !== undefined && { discountPercent: parsed.data.discountPercent }),
      ...(parsed.data.maxUses         !== undefined && { maxUses: parsed.data.maxUses }),
      ...(parsed.data.expiresAt       !== undefined && { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }),
      ...(parsed.data.isActive        !== undefined && { isActive: parsed.data.isActive }),
    },
    include: {
      program: { select: { id: true, name: true } },
    },
  });

  return ok({ code: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { codeId } = await params;

  const code = await prisma.discountCode.findFirst({
    where: { id: codeId, organizationId: session.user.organizationId ?? undefined },
  });
  if (!code) return fail("Discount code not found.", 404);

  await prisma.discountCode.delete({ where: { id: codeId } });

  return ok({ deleted: true });
}
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDiscountCodeSchema } from "@/lib/validators";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const codes = await prisma.discountCode.findMany({
    where: { organizationId: session.user.organizationId ?? undefined },
    include: {
      program: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { redemptions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ codes });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);
  if (!session.user.organizationId) return fail("Organization not found.", 400);

  const body = await request.json();
  const parsed = createDiscountCodeSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  // Check code uniqueness
  const conflict = await prisma.discountCode.findUnique({ where: { code: parsed.data.code } });
  if (conflict) return fail("This code is already in use.", 409);

  // Validate programId belongs to org if provided
  if (parsed.data.programId) {
    const program = await prisma.program.findFirst({
      where: { id: parsed.data.programId, organizationId: session.user.organizationId },
    });
    if (!program) return fail("Program not found.", 404);
  }

  const code = await prisma.discountCode.create({
    data: {
      organizationId:  session.user.organizationId,
      code:            parsed.data.code,
      description:     parsed.data.description,
      discountPercent: parsed.data.discountPercent,
      programId:       parsed.data.programId ?? null,
      maxUses:         parsed.data.maxUses ?? null,
      expiresAt:       parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdById:     session.user.id,
    },
    include: {
      program: { select: { id: true, name: true } },
    },
  });

  return ok({ code }, 201);
}
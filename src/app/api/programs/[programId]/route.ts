import { ProgramLevel, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ programId: string }> }

const updateProgramSchema = z.object({
  name:            z.string().trim().min(3).max(150).optional(),
  slug:            z.string().trim().min(3).max(150).optional(),
  description:     z.string().trim().max(4000).optional().nullable(),
  level:           z.nativeEnum(ProgramLevel).optional(),
  monthlyFee:      z.number().positive().optional(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
});

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { programId } = await params;

  const program = await prisma.program.findFirst({
    where: { id: programId, organizationId: session.user.organizationId ?? undefined },
  });
  if (!program) return fail("Program not found.", 404);

  const body = await request.json();
  const parsed = updateProgramSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  if (parsed.data.slug && parsed.data.slug !== program.slug) {
    const conflict = await prisma.program.findUnique({ where: { slug: parsed.data.slug } });
    if (conflict) return fail("Slug already in use.", 409);
  }

  const updated = await prisma.program.update({
    where: { id: programId },
    data: {
      ...(parsed.data.name            !== undefined && { name: parsed.data.name }),
      ...(parsed.data.slug            !== undefined && { slug: parsed.data.slug }),
      ...(parsed.data.description     !== undefined && { description: parsed.data.description }),
      ...(parsed.data.level           !== undefined && { level: parsed.data.level }),
      ...(parsed.data.monthlyFee      !== undefined && { monthlyFee: parsed.data.monthlyFee }),
      ...(parsed.data.discountPercent !== undefined && { discountPercent: parsed.data.discountPercent }),
    },
  });

  return ok({ program: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { programId } = await params;

  const program = await prisma.program.findFirst({
    where: { id: programId, organizationId: session.user.organizationId ?? undefined },
  });
  if (!program) return fail("Program not found.", 404);

  // Toggle archive — archived programs are hidden from learners but data is preserved
  const updated = await prisma.program.update({
    where: { id: programId },
    data: { isActive: !program.isActive },
  });

  return ok({ program: updated });
}
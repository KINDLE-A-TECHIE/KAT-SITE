import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateDiscountCodeSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const body = await request.json();
  const parsed = validateDiscountCodeSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const code = await prisma.discountCode.findUnique({
    where: { code: parsed.data.code },
    include: { program: { select: { id: true, name: true } } },
  });

  if (!code || !code.isActive) return fail("Invalid or expired discount code.", 404);

  // Check expiry
  if (code.expiresAt && code.expiresAt < new Date()) {
    return fail("This discount code has expired.", 410);
  }

  // Check usage limit
  if (code.maxUses !== null && code.usedCount >= code.maxUses) {
    return fail("This discount code has reached its usage limit.", 410);
  }

  // Check program restriction
  if (code.programId && code.programId !== parsed.data.programId) {
    return fail("This code is not valid for the selected program.", 422);
  }

  // Verify the program belongs to the same org as the code
  const program = await prisma.program.findFirst({
    where: { id: parsed.data.programId, organizationId: code.organizationId },
    select: { id: true, name: true, monthlyFee: true },
  });
  if (!program) return fail("Program not found.", 404);

  return ok({
    valid: true,
    code: code.code,
    description: code.description,
    discountPercent: Number(code.discountPercent),
    appliesTo: code.programId ? code.program?.name : "All programs",
    usedCount: code.usedCount,
    maxUses: code.maxUses,
    expiresAt: code.expiresAt,
  });
}
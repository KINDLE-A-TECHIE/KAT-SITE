import { ProgramLevel, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createProgramSchema = z.object({
  name:            z.string().trim().min(3).max(150),
  slug:            z.string().trim().min(3).max(150),
  description:     z.string().trim().max(4000).optional(),
  level:           z.nativeEnum(ProgramLevel),
  monthlyFee:      z.number().positive(),
  discountPercent: z.number().min(0).max(100).optional(),
});

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const programs = await prisma.program.findMany({
    where: {
      organizationId: session?.user.organizationId ?? undefined,
      isActive: includeInactive ? undefined : true,
    },
    include: {
      cohorts: {
        select: {
          id: true,
          name: true,
          startsAt: true,
          endsAt: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
          assessments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok({ programs });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const role = session.user.role;
  if (role !== UserRole.SUPER_ADMIN && role !== UserRole.ADMIN) {
    return fail("Forbidden", 403);
  }

  const body = await request.json();
  const parsed = createProgramSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid program payload.", 400, parsed.error.flatten());
  }

  if (!session.user.organizationId) {
    return fail("Organization not found for user.", 400);
  }

  const program = await prisma.program.create({
    data: {
      name:            parsed.data.name,
      slug:            parsed.data.slug,
      description:     parsed.data.description,
      level:           parsed.data.level,
      monthlyFee:      parsed.data.monthlyFee,
      discountPercent: parsed.data.discountPercent ?? null,
      organizationId:  session.user.organizationId!,
    },
  });

  return ok({ program }, 201);
}

import { UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ cohortId: string }>;
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  applicationOpen: z.boolean().optional(),
  applicationClosesAt: z.string().datetime().nullable().optional(),
  externalApplicationFee: z.number().nullable().optional(),
});

export async function GET(req: Request, { params }: Params) {
  const { cohortId } = await params;
  const url = new URL(req.url);
  const isPublic = url.searchParams.get("public") === "1";

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      applicationOpen: true,
      applicationClosesAt: true,
      externalApplicationFee: true,
      programId: true,
      organizationId: true,
      program: {
        select: { id: true, name: true, level: true, description: true },
      },
      _count: { select: { fellowApplications: true } },
    },
  });

  if (!cohort) return fail("Cohort not found.", 404);

  // Public requests only see open cohorts (used by the fellowship apply page)
  if (isPublic) {
    if (!cohort.applicationOpen) return fail("Cohort not found.", 404);
    return ok({
      cohort: {
        id: cohort.id,
        name: cohort.name,
        applicationClosesAt: cohort.applicationClosesAt,
        externalApplicationFee: cohort.externalApplicationFee
          ? Number(cohort.externalApplicationFee)
          : null,
        program: cohort.program ? { name: cohort.program.name, level: cohort.program.level } : null,
      },
    });
  }

  // Authenticated requests
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  if (
    role !== UserRole.SUPER_ADMIN &&
    cohort.organizationId !== session.user.organizationId
  ) {
    return fail("Forbidden", 403);
  }

  return ok({ cohort });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const role = session.user.role as UserRole;
  if (role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { cohortId } = await params;

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true },
  });
  if (!cohort) return fail("Cohort not found.", 404);

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const { name, startsAt, endsAt, capacity, applicationOpen, applicationClosesAt, externalApplicationFee } = parsed.data;

  try {
    const updated = await prisma.cohort.update({
      where: { id: cohortId },
      data: {
        ...(name !== undefined && { name }),
        ...(startsAt !== undefined && { startsAt: new Date(startsAt) }),
        ...(endsAt !== undefined && { endsAt: new Date(endsAt) }),
        ...(capacity !== undefined && { capacity }),
        ...(applicationOpen !== undefined && { applicationOpen }),
        ...(applicationClosesAt !== undefined && {
          applicationClosesAt: applicationClosesAt === null ? null : new Date(applicationClosesAt),
        }),
        ...(externalApplicationFee !== undefined && {
          externalApplicationFee: externalApplicationFee === null ? null : externalApplicationFee,
        }),
      },
      include: { program: { select: { id: true, name: true, level: true } } },
    });

    return ok({ cohort: updated });
  } catch (error) {
    return fail("Could not update cohort.", 500, error instanceof Error ? error.message : error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role as UserRole !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const { cohortId } = await params;

  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, _count: { select: { fellowApplications: true } } },
  });
  if (!cohort) return fail("Cohort not found.", 404);
  if (cohort._count.fellowApplications > 0) {
    return fail("Cannot delete a cohort that has applications. Close it instead.", 400);
  }

  try {
    await prisma.cohort.delete({ where: { id: cohortId } });
    return ok({ deleted: true });
  } catch (error) {
    return fail("Could not delete cohort.", 500, error instanceof Error ? error.message : error);
  }
}

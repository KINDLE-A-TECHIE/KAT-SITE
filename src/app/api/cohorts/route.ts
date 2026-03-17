import { UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createCohortSchema = z.object({
  programId: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(120),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().positive().nullable().optional(),
  applicationOpen: z.boolean().optional(),
  applicationClosesAt: z.string().datetime().nullable().optional(),
  externalApplicationFee: z.number().nonnegative().nullable().optional(),
});

export async function GET() {
  const session = await getServerAuthSession();
  const role = session?.user?.role as UserRole | undefined;
  const isAdmin =
    role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;

  const now = new Date();

  const cohorts = await prisma.cohort.findMany({
    where: isAdmin
      ? undefined
      : {
          applicationOpen: true,
          OR: [
            { applicationClosesAt: null },
            { applicationClosesAt: { gt: now } },
          ],
        },
    select: {
      id: true,
      name: true,
      startsAt: true,
      endsAt: true,
      applicationClosesAt: true,
      externalApplicationFee: true,
      capacity: true,
      applicationOpen: true,
      programId: true,
      program: {
        select: {
          id: true,
          name: true,
          level: true,
          description: true,
        },
      },
      _count: {
        select: {
          fellowApplications: true,
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return ok({ cohorts });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = createCohortSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const { programId, name, startsAt, endsAt, capacity, applicationOpen, applicationClosesAt, externalApplicationFee } = parsed.data;

  try {
    // Resolve organizationId — from linked program if given, otherwise from session user,
    // falling back to a DB lookup in case the session token pre-dates the org assignment.
    let organizationId = session.user.organizationId ?? null;

    if (programId) {
      const program = await prisma.program.findUnique({
        where: { id: programId },
        select: { id: true, organizationId: true },
      });
      if (!program) return fail("Program not found.", 404);
      organizationId = program.organizationId;
    }

    if (!organizationId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { organizationId: true },
      });
      organizationId = dbUser?.organizationId ?? null;
    }

    if (!organizationId) return fail("Could not resolve organization for this user.", 400);

    const cohort = await prisma.cohort.create({
      data: {
        organizationId,
        programId: programId ?? null,
        name,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        capacity: capacity ?? null,
        applicationOpen: applicationOpen ?? false,
        applicationClosesAt: applicationClosesAt ? new Date(applicationClosesAt) : null,
        externalApplicationFee: externalApplicationFee ?? null,
      },
      include: { program: { select: { id: true, name: true, level: true } } },
    });

    return ok({ cohort }, 201);
  } catch (error) {
    return fail("Could not create cohort.", 500, error instanceof Error ? error.message : error);
  }
}

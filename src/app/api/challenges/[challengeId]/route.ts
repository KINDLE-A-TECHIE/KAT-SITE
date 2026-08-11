import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { capabilityDenied } from "@/lib/capabilities";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkChallengeProgram, notifyEligibleStudents } from "@/lib/challenges";

interface Params { params: Promise<{ challengeId: string }> }

const MANAGER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

const updateChallengeSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  weekNumber: z.number().int().min(1).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  points: z.number().int().min(1).max(10000).optional(),
  published: z.boolean().optional(),
  moduleId: z.string().cuid().nullable().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!MANAGER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (capabilityDenied(session.user, "challenges")) return fail("Forbidden", 403);

  const { challengeId } = await params;
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, organizationId: true, programId: true, moduleId: true, published: true, title: true },
  });
  if (!challenge) return fail("Challenge not found.", 404);

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    challenge.organizationId !== session.user.organizationId
  ) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = updateChallengeSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const wasPublished = challenge.published;

  const updated = await prisma.challenge.update({
    where: { id: challengeId },
    data: {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.weekNumber !== undefined && { weekNumber: parsed.data.weekNumber }),
      ...(parsed.data.dueDate !== undefined && { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }),
      ...(parsed.data.points !== undefined && { points: parsed.data.points }),
      ...(parsed.data.published !== undefined && { published: parsed.data.published }),
      ...(parsed.data.moduleId !== undefined && { moduleId: parsed.data.moduleId }),
    },
    include: {
      program: { select: { id: true, name: true } },
      module: { select: { id: true, title: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { submissions: true } },
    },
  });

  // Notify students when a challenge is published for the first time.
  // The audience is re-checked here, not assumed from creation.
  if (!wasPublished && parsed.data.published === true) {
    const audienceProblem = await checkChallengeProgram(updated.programId);
    if (audienceProblem) return fail(audienceProblem, 422);

    await notifyEligibleStudents(
      updated.id,
      updated.programId,
      updated.moduleId,
      session.user.id,
      updated.title,
    );
  }

  return ok({ challenge: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!MANAGER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (capabilityDenied(session.user, "challenges")) return fail("Forbidden", 403);

  const { challengeId } = await params;
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { id: true, organizationId: true },
  });
  if (!challenge) return fail("Challenge not found.", 404);

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    challenge.organizationId !== session.user.organizationId
  ) return fail("Forbidden", 403);

  await prisma.challenge.delete({ where: { id: challengeId } });
  return ok({ challengeId });
}

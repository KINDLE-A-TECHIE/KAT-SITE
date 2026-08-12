import { z } from "zod";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { capabilityDenied } from "@/lib/capabilities";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkChallengeProgram, notifyEligibleStudents } from "@/lib/challenges";

const MANAGER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];
const LEARNER_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];

const createChallengeSchema = z.object({
  programId: z.string().cuid(),
  moduleId: z.string().cuid().nullable().optional(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  weekNumber: z.number().int().min(1).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  points: z.number().int().min(1).max(10000).default(100),
  published: z.boolean().default(false),
});

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id: userId, role, organizationId } = session.user;

  if (LEARNER_ROLES.includes(role as UserRole)) {
    // Students/Fellows: only see challenges for programs they're enrolled in,
    // scoped to modules they've reached (or global challenges with no module).
    const [enrollments, gateStatuses] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId, status: "ACTIVE" },
        select: { programId: true },
      }),
      prisma.moduleGateStatus.findMany({
        where: { userId },
        select: { moduleId: true },
      }),
    ]);

    const programIds = enrollments.map((e) => e.programId);
    const unlockedModuleIds = gateStatuses.map((g) => g.moduleId);

    if (programIds.length === 0) return ok({ challenges: [] });

    const challenges = await prisma.challenge.findMany({
      where: {
        programId: { in: programIds },
        published: true,
        OR: [
          { moduleId: null },
          { moduleId: { in: unlockedModuleIds } },
        ],
      },
      include: {
        program: { select: { id: true, name: true } },
        module: { select: { id: true, title: true } },
        submissions: {
          where: { studentId: userId },
          select: {
            id: true, score: true, feedback: true, gradedAt: true,
            submittedAt: true, linkUrl: true, fileUrl: true, fileName: true, note: true,
          },
          take: 1,
        },
        _count: { select: { submissions: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    return ok({ challenges });
  }

  if (MANAGER_ROLES.includes(role as UserRole)) {
    if (capabilityDenied(session.user, "challenges")) return fail("Forbidden", 403);
    // Managers: see all challenges in their org
    const challenges = await prisma.challenge.findMany({
      where: organizationId ? { organizationId } : {},
      include: {
        program: { select: { id: true, name: true } },
        module: { select: { id: true, title: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ challenges });
  }

  return ok({ challenges: [] });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!MANAGER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);
  if (capabilityDenied(session.user, "challenges")) return fail("Forbidden", 403);

  const body = await request.json() as unknown;
  const parsed = createChallengeSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const program = await prisma.program.findUnique({
    where: { id: parsed.data.programId },
    select: { id: true, organizationId: true },
  });
  if (!program) return fail("Program not found.", 404);

  // Challenges are B2C. Attaching one to a SCHOOL programme would notify that school's children
  // about a surface they cannot reach.
  const audienceProblem = await checkChallengeProgram(parsed.data.programId);
  if (audienceProblem) return fail(audienceProblem, 422);

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    program.organizationId !== session.user.organizationId
  ) return fail("Forbidden", 403);

  if (parsed.data.moduleId) {
    const mod = await prisma.module.findFirst({
      where: {
        id: parsed.data.moduleId,
        version: { curriculum: { programId: parsed.data.programId } },
      },
      select: { id: true },
    });
    if (!mod) return fail("Module does not belong to the selected program.", 400);
  }

  const challenge = await prisma.challenge.create({
    data: {
      organizationId: program.organizationId,
      programId: parsed.data.programId,
      moduleId: parsed.data.moduleId ?? null,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      weekNumber: parsed.data.weekNumber ?? null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      points: parsed.data.points,
      published: parsed.data.published,
      createdById: session.user.id,
    },
    include: {
      program: { select: { id: true, name: true } },
      module: { select: { id: true, title: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      _count: { select: { submissions: true } },
    },
  });

  // Notify eligible students when publishing immediately
  if (parsed.data.published) {
    await notifyEligibleStudents(challenge.id, parsed.data.programId, parsed.data.moduleId ?? null, session.user.id, challenge.title);
  }

  return ok({ challenge }, 201);
}

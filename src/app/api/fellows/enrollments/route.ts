import { ApplicationStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const assignSchema = z.object({
  userId: z.string().cuid(),
  programId: z.string().cuid(),
});

const unassignSchema = z.object({
  enrollmentId: z.string().cuid(),
});

// GET /api/fellows/enrollments?cohortId=XXX
// Returns every approved fellow in the cohort together with their current program enrollments.
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const url = new URL(request.url);
  const cohortId = url.searchParams.get("cohortId");
  if (!cohortId) return fail("cohortId is required.", 400);

  const applications = await prisma.fellowApplication.findMany({
    where: { cohortId, status: ApplicationStatus.APPROVED, applicantId: { not: null } },
    select: {
      id: true,
      applicant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          enrollments: {
            select: {
              id: true,
              status: true,
              enrolledAt: true,
              program: { select: { id: true, name: true, level: true } },
            },
          },
        },
      },
    },
    orderBy: { reviewedAt: "asc" },
  });

  const fellows = applications
    .filter((a) => a.applicant !== null)
    .map((a) => ({
      applicationId: a.id,
      userId: a.applicant!.id,
      firstName: a.applicant!.firstName,
      lastName: a.applicant!.lastName,
      email: a.applicant!.email,
      enrollments: a.applicant!.enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt,
        programId: e.program.id,
        programName: e.program.name,
        programLevel: e.program.level,
      })),
    }));

  return ok({ fellows });
}

// POST — assign an approved fellow to a program (creates an Enrollment with no billing cycle).
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const { userId, programId } = parsed.data;

  const [user, program] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } }),
    prisma.program.findUnique({ where: { id: programId }, select: { id: true } }),
  ]);

  if (!user) return fail("User not found.", 404);
  if (!program) return fail("Program not found.", 404);
  if (user.role !== UserRole.FELLOW) return fail("User is not a fellow.", 400);

  const existing = await prisma.enrollment.findUnique({
    where: { userId_programId: { userId, programId } },
    select: { id: true },
  });
  if (existing) return fail("Fellow is already enrolled in this program.", 409);

  const enrollment = await prisma.enrollment.create({
    data: { userId, programId, status: "ACTIVE" },
    include: { program: { select: { id: true, name: true, level: true } } },
  });

  return ok({
    enrollment: {
      id: enrollment.id,
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt,
      programId: enrollment.program.id,
      programName: enrollment.program.name,
      programLevel: enrollment.program.level,
    },
  }, 201);
}

// DELETE — remove a fellow's program enrollment.
export async function DELETE(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (session.user.role !== UserRole.SUPER_ADMIN) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = unassignSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: parsed.data.enrollmentId },
    select: { id: true, user: { select: { role: true } } },
  });
  if (!enrollment) return fail("Enrollment not found.", 404);
  if (enrollment.user.role !== UserRole.FELLOW) {
    return fail("Can only unassign fellows via this endpoint.", 400);
  }

  await prisma.enrollment.delete({ where: { id: parsed.data.enrollmentId } });
  return ok({ deleted: true });
}

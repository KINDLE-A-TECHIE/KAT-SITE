import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retakeGrantSchema } from "@/lib/validators";

const GRANTER_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

// POST — grant a retake to a student for an assessment
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!GRANTER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const body = await request.json();
  const parsed = retakeGrantSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const { assessmentId, studentId } = parsed.data;

  // Fetch assessment + granter permissions in parallel
  const [assessment, granter] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { id: true, createdById: true, program: { select: { organizationId: true } } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { canGrantRetakes: true },
    }),
  ]);

  if (!assessment) return fail("Assessment not found.", 404);

  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;

  // Non-SA must have retake permission enabled
  if (!isSuperAdmin && !granter?.canGrantRetakes) {
    return fail("You do not have permission to grant retakes.", 403);
  }

  // Non-SA can only grant retakes for assessments they created
  if (!isSuperAdmin && assessment.createdById !== session.user.id) {
    return fail("You can only grant retakes for assessments you created.", 403);
  }

  // Verify the student exists and has a submission
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, role: true },
  });
  if (!student || !["STUDENT", "FELLOW"].includes(student.role)) {
    return fail("Student not found.", 404);
  }

  const hasSubmission = await prisma.assessmentSubmission.findFirst({
    where: { assessmentId, studentId },
    select: { id: true },
  });
  if (!hasSubmission) return fail("This student has not submitted this assessment yet.", 400);

  // Check for an existing unused grant
  const existingGrant = await prisma.retakeGrant.findFirst({
    where: { assessmentId, studentId, usedAt: null },
    select: { id: true },
  });
  if (existingGrant) return fail("A retake has already been granted for this student.", 400);

  const grant = await prisma.retakeGrant.create({
    data: { assessmentId, studentId, grantedById: session.user.id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      assessment: { select: { id: true, title: true } },
    },
  });

  return ok({ grant }, 201);
}

// GET — list retake grants (graders see grants for their assessments; SA sees all)
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!GRANTER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const url = new URL(request.url);
  const assessmentId = url.searchParams.get("assessmentId");

  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;

  const grants = await prisma.retakeGrant.findMany({
    where: {
      ...(assessmentId ? { assessmentId } : {}),
      ...(!isSuperAdmin ? { assessment: { createdById: session.user.id } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      student:    { select: { id: true, firstName: true, lastName: true, email: true } },
      assessment: { select: { id: true, title: true } },
      grantedBy:  { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return ok({ grants });
}

// DELETE — cancel an unused retake grant
export async function DELETE(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!GRANTER_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const url = new URL(request.url);
  const grantId = url.searchParams.get("grantId");
  if (!grantId) return fail("grantId is required.", 400);

  const grant = await prisma.retakeGrant.findUnique({
    where: { id: grantId },
    select: { id: true, usedAt: true, assessment: { select: { createdById: true } } },
  });
  if (!grant) return fail("Grant not found.", 404);
  if (grant.usedAt) return fail("This grant has already been used.", 400);

  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;
  if (!isSuperAdmin && grant.assessment.createdById !== session.user.id) {
    return fail("Forbidden", 403);
  }

  await prisma.retakeGrant.delete({ where: { id: grantId } });
  return ok({ message: "Retake grant cancelled." });
}

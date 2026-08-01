import { EnrollmentStatus, GateStatus, SchoolRole, Strand } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense } from "@/lib/school-license";
import { setSchoolInstructorGate } from "@/lib/mastery";
import { schoolModuleSignoffSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * A teacher signs off the instructor gate for pupils on one CODING module of their class, and
 * sees the combined 3-gate mastery (assessment + project + teacher) per pupil. REPORT-ONLY: a
 * sign-off records the teacher's judgement, it never blocks advancement and sends no notification.
 *
 * Scoped to a class this teacher owns (schoolId + teacherId). Gates are a CODING-strand concept,
 * so DIGLIT units are rejected. Pupils are addressed by an opaque userId in the body, never a URL.
 */

async function ownClass(schoolId: string, teacherId: string, classId: string) {
  return prisma.schoolClass.findFirst({
    where: { id: classId, schoolId, teacherId },
    select: { id: true, sessionLabel: true, programId: true },
  });
}

// The module must belong to this class's course AND be a CODING unit (a module's own strand
// wins, falling back to the programme's). Returns the module id, or null.
async function codingModuleInClass(programId: string | null, moduleId: string): Promise<string | null> {
  if (!programId) return null;
  const moduleRecord = await prisma.module.findFirst({
    where: { id: moduleId, version: { curriculum: { programId } } },
    select: { id: true, strand: true, version: { select: { curriculum: { select: { program: { select: { strand: true } } } } } } },
  });
  if (!moduleRecord) return null;
  const effective = moduleRecord.strand ?? moduleRecord.version.curriculum.program.strand;
  return effective === Strand.CODING ? moduleRecord.id : null;
}

export async function GET(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const moduleId = url.searchParams.get("moduleId");
  if (!classId || !moduleId) return fail("classId and moduleId are required.", 400);

  try {
    const cls = await ownClass(schoolId, session!.user.id, classId);
    if (!cls) return fail("Class not found.", 404);
    const gate = await checkClassLicense(schoolId, cls.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);
    if (!(await codingModuleInClass(cls.programId, moduleId))) {
      return fail("That unit is not a coding unit of this class's course.", 422);
    }

    const roster = await prisma.enrollment.findMany({
      where: { schoolClassId: classId, schoolId, status: EnrollmentStatus.ACTIVE },
      select: { userId: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });
    const userIds = roster.map((r) => r.userId);

    const gates = userIds.length
      ? await prisma.moduleGateStatus.findMany({
          where: { userId: { in: userIds }, moduleId },
          select: {
            userId: true,
            assessmentGate: true,
            projectGate: true,
            instructorGate: true,
            allGatesPassed: true,
          },
        })
      : [];
    const gateOf = new Map(gates.map((g) => [g.userId, g]));

    return ok({
      classId,
      moduleId,
      pupils: roster.map((r) => {
        const g = gateOf.get(r.userId);
        return {
          userId: r.userId,
          name: `${r.user.firstName} ${r.user.lastName}`.trim(),
          assessmentGate: g?.assessmentGate ?? GateStatus.NOT_STARTED,
          projectGate: g?.projectGate ?? GateStatus.NOT_STARTED,
          instructorGate: g?.instructorGate ?? GateStatus.NOT_STARTED,
          allGatesPassed: g?.allGatesPassed ?? false,
        };
      }),
    });
  } catch (error) {
    captureError(error);
    return fail("Could not load mastery.", 500);
  }
}

export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();
  const teacherId = session!.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = schoolModuleSignoffSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());
  const { classId, moduleId, userId, passed } = parsed.data;

  try {
    const cls = await ownClass(schoolId, teacherId, classId);
    if (!cls) return fail("Class not found.", 404);
    const licence = await checkClassLicense(schoolId, cls.sessionLabel);
    if (!licence.allowed) return fail(licence.reason, 403);
    if (!(await codingModuleInClass(cls.programId, moduleId))) {
      return fail("That unit is not a coding unit of this class's course.", 422);
    }

    // The pupil must be an active member of THIS class.
    const enrolled = await prisma.enrollment.findFirst({
      where: { userId, schoolClassId: classId, schoolId, status: EnrollmentStatus.ACTIVE },
      select: { id: true },
    });
    if (!enrolled) return fail("That pupil is not in this class.", 422);

    const result = await setSchoolInstructorGate(teacherId, userId, moduleId, passed);
    if (!result) return fail("Could not update the sign-off.", 500);

    return ok({ signedOff: passed, allGatesPassed: result.allGatesPassed });
  } catch (error) {
    captureError(error);
    return fail("Could not update the sign-off.", 500);
  }
}

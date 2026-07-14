import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkCourseAssignable, listCoursesForLevel } from "@/lib/school-course";
import { checkClassLicense } from "@/lib/school-license";
import { schoolClassCourseSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * A teacher's own classes. TEACHER role only.
 *
 * DOUBLE SCOPING: every query filters by schoolId (tenant) AND teacherId (the
 * caller). A teacher can therefore never see or mutate a colleague's class, even
 * within their own school.
 */

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

// GET /api/school/teach/classes, the caller's own classes, with assignable courses.
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    return guardFail(error);
  }

  const session = await getServerAuthSession();

  try {
    const classes = await prisma.schoolClass.findMany({
      where: { schoolId, teacherId: session!.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        nerdcLevel: true,
        term: true,
        programId: true,
        program: { select: { id: true, name: true } },
        _count: { select: { enrollments: true } },
      },
    });

    // LICENCE GATE. Seats are bought per term, so each class is gated by ITS OWN
    // term's licence, a teacher can hold a class in a paid term and another in a
    // lapsed one. The class is still listed (so they can see what is blocked and
    // why), but it is marked unlicensed and its roster/results are refused.
    const gates = await Promise.all(classes.map((c) => checkClassLicense(schoolId, c.term)));
    const gated = classes.map((c, i) => ({
      ...c,
      licensed: gates[i].allowed,
      licenseReason: gates[i].allowed ? null : gates[i].reason,
    }));

    // The courses each class could be assigned, by its NERDC level.
    const levels = [...new Set(classes.map((c) => c.nerdcLevel))];
    const courseLists = await Promise.all(levels.map((l) => listCoursesForLevel(l)));
    const coursesByLevel = Object.fromEntries(levels.map((l, i) => [l, courseLists[i]]));

    return ok({ classes: gated, coursesByLevel });
  } catch (error) {
    captureError(error);
    return fail("Could not load your classes.", 500);
  }
}

// PATCH /api/school/teach/classes, assign the course this class delivers.
export async function PATCH(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    return guardFail(error);
  }

  const session = await getServerAuthSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolClassCourseSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid payload.", 400, parsed.error.flatten());
  }
  const { id, programId } = parsed.data;

  try {
    // Scoped by schoolId AND teacherId: another teacher's class simply isn't found.
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id, schoolId, teacherId: session!.user.id },
      select: { id: true, nerdcLevel: true, programId: true, term: true },
    });
    if (!schoolClass) return fail("Class not found.", 404);

    // A teacher cannot act on a class whose term is not licensed.
    const gate = await checkClassLicense(schoolId, schoolClass.term);
    if (!gate.allowed) return fail(gate.reason, 403);

    const problem = await checkCourseAssignable(schoolClass, programId);
    if (problem) return fail(problem, 422);

    const updated = await prisma.schoolClass.update({
      where: { id: schoolClass.id },
      data: { programId },
      select: { id: true, programId: true, program: { select: { id: true, name: true } } },
    });

    return ok({ class: updated });
  } catch (error) {
    captureError(error);
    return fail("Could not assign the course.", 500);
  }
}

import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { getClassTermSummary } from "@/lib/school-report";
import { getClassCoverage } from "@/lib/school-coverage";
import { normalizeTerm } from "@/lib/school-license";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/school/reports?term=…&classId=…
 *
 * The termly progress & NERDC-coverage report, per class, or across the whole school
 * for a term.
 *
 *   SCHOOL_ADMIN → any class in their school, or the whole school for a term
 *   TEACHER      → their OWN classes only (scoped schoolId AND teacherId)
 *
 * STRICTLY schoolId-scoped: the class list is derived from a query filtered by
 * schoolId, never from ids supplied by the caller.
 *
 * Only class ids and the term travel in the query string, never a student's id or name.
 */
export async function GET(request: Request) {
  let schoolId: string;
  let role: SchoolRole;
  try {
    ({ schoolId, role } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN, SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const term = url.searchParams.get("term");
  const classId = url.searchParams.get("classId");

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });

    // The set of classes in scope. Always filtered by schoolId, and additionally by
    // teacherId for a teacher, a schoolId filter alone would let a teacher report on
    // a colleague's class.
    const classes = await prisma.schoolClass.findMany({
      where: {
        schoolId, ...(classId ? { id: classId } : {}), ...(role === SchoolRole.TEACHER ? { teacherId: session!.user.id } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, term: true },
    });

    // Term is free text, so filter on the normalized form.
    const wanted = term ? normalizeTerm(term) : null;
    const inScope = wanted ? classes.filter((c) => normalizeTerm(c.term) === wanted) : classes;

    if (classId && inScope.length === 0) {
      return fail("Class not found.", 404);
    }

    const sections = await Promise.all(
      inScope.map(async (c) => {
        const [summary, coverage] = await Promise.all([
          getClassTermSummary(schoolId, c.id),
          getClassCoverage(schoolId, c.id),
        ]);
        return summary && coverage ? { summary, coverage } : null;
      }),
    );

    const licences = await prisma.schoolLicense.findMany({
      where: { schoolId, ...(wanted ? {} : {}) },
      select: { term: true, status: true, seatLimit: true, seatsUsed: true },
    });
    const licence =
      licences.find((l) => (wanted ? normalizeTerm(l.term) === wanted : false)) ?? null;

    return ok({
      school: { name: school?.name ?? "" },
      term: term ?? null,
      scope: classId ? "class" : "school",
      licence,
      generatedAt: new Date().toISOString(),
      classes: sections.filter((s): s is NonNullable<typeof s> => s !== null),
    });
  } catch (error) {
    captureError(error);
    return fail("Could not build the report.", 500);
  }
}

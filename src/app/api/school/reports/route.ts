import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { requireActiveSchool } from "@/lib/school";
import { getSchoolReport, ReportClassNotFoundError } from "@/lib/school-report-data";
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
  const sessionLabel = url.searchParams.get("session");
  const classId = url.searchParams.get("classId");

  try {
    const report = await getSchoolReport(schoolId, role, session!.user.id, { session: sessionLabel, classId });
    return ok(report);
  } catch (error) {
    if (error instanceof ReportClassNotFoundError) return fail("Class not found.", 404);
    captureError(error);
    return fail("Could not build the report.", 500);
  }
}

import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { getClassTermSummary } from "@/lib/school-report";
import { checkClassLicense } from "@/lib/school-license";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/school/results?classId=…, class results + per-student mastery.
 *
 * One route, two callers, one guard:
 *   TEACHER      → their OWN classes only (scoped schoolId AND teacherId)
 *   SCHOOL_ADMIN → any class in their school (scoped schoolId)
 *
 * The Phase 4 termly report reads this same payload, so results can never diverge
 * between what a teacher sees and what a report states.
 *
 * Only the CLASS id travels in the query string, never a student's id, name or email.
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
  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return fail("classId is required.", 400);

  try {
    // A teacher may only ever read their own class. A schoolId filter alone would
    // let them read a colleague's results.
    const visible = await prisma.schoolClass.findFirst({
      where: {
        id: classId,
        schoolId, ...(role === SchoolRole.TEACHER ? { teacherId: session!.user.id } : {}),
      },
      select: { id: true, sessionLabel: true },
    });
    if (!visible) return fail("Class not found.", 404);

    // LICENCE GATE, teachers only. A SCHOOL_ADMIN must still be able to see their
    // school when a licence lapses, since they are the one who has to go and fix it;
    // locking them out of the thing that unlocks the school would be a deadlock.
    if (role === SchoolRole.TEACHER) {
      const gate = await checkClassLicense(schoolId, visible.sessionLabel);
      if (!gate.allowed) return fail(gate.reason, 403);
    }

    const summary = await getClassTermSummary(schoolId, classId);
    if (!summary) return fail("Class not found.", 404);

    return ok(summary);
  } catch (error) {
    captureError(error);
    return fail("Could not load results.", 500);
  }
}

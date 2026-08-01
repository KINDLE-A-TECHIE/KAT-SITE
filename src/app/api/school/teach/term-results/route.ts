import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense } from "@/lib/school-license";
import { computeClassTermResults } from "@/lib/school-grading";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/school/teach/term-results?classId=[&userId=], the weighted CA + Exam term result per pupil
 * per module for a class (the number a report card carries). Scoped to a class this teacher owns.
 *
 * Pupil names travel in the response body (the teacher needs them), never in a URL. `userId` (an opaque
 * cuid, not a name/email) narrows to one pupil for a report card.
 */
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
  const userId = url.searchParams.get("userId");
  if (!classId) return fail("classId is required.", 400);

  try {
    const cls = await prisma.schoolClass.findFirst({
      where: { id: classId, schoolId, teacherId: session!.user.id },
      select: { id: true, name: true, sessionLabel: true },
    });
    if (!cls) return fail("Class not found.", 404);
    const gate = await checkClassLicense(schoolId, cls.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);

    const data = await computeClassTermResults(classId);
    const pupils = userId ? data.pupils.filter((p) => p.userId === userId) : data.pupils;

    return ok({
      class: { id: cls.id, name: cls.name, sessionLabel: cls.sessionLabel },
      modules: data.modules,
      pupils,
    });
  } catch (error) {
    captureError(error);
    return fail("Could not load term results.", 500);
  }
}

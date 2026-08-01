import { EnrollmentStatus, SchoolRole, Strand } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense, getLicensedTermNumbers } from "@/lib/school-license";
import { termNumberForModule } from "@/lib/school-term";
import { schoolLessonClassCompleteSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/school/teach/complete-lesson, a teacher records that their class finished a DIGLIT lesson.
 *
 * Digital-literacy units are slides and worksheets, delivered from the front of the room. In a class
 * that shares a projector (or has no devices at all), pupils never each click through the lesson, so
 * it would never register as complete, and the child would look like they did nothing. This lets the
 * teacher record what actually happened: the class did this lesson. It writes LessonProgress for every
 * ACTIVE pupil on the class roster, so completion, reports, and term certificates reflect reality.
 *
 * Guardrails:
 *   - teacher-only, and only for THEIR OWN class (scoped schoolId AND teacherId);
 *   - DIGLIT lessons ONLY. Coding is individual skill and keeps its per-pupil path; a teacher must not
 *     be able to blanket-complete coding work the pupils did not do;
 *   - the lesson's term must be licensed (same money gate as everywhere else);
 *   - pupils are the class's own roster, resolved here, never named in the request (minors' data).
 *
 * It never un-completes: create-only (skipDuplicates), so a pupil who genuinely finished the lesson
 * themselves keeps their own completion timestamp.
 */
export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolLessonClassCompleteSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());
  const { classId, lessonId } = parsed.data;

  try {
    // The class must be THIS teacher's, in THIS school.
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: classId, schoolId, teacherId: session!.user.id },
      select: { id: true, sessionLabel: true, programId: true },
    });
    if (!schoolClass) return fail("Class not found.", 404);

    const gate = await checkClassLicense(schoolId, schoolClass.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);

    // The lesson must belong to the course this class delivers (a valid class is not a key to any
    // lesson), and we need its module strand + term to gate on.
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        module: { version: { curriculum: { programId: schoolClass.programId ?? "" } } },
      },
      select: { id: true, module: { select: { sortOrder: true, strand: true } } },
    });
    if (!lesson) return fail("That lesson is not part of this class's course.", 422);

    // DIGLIT only. Coding stays per-pupil (mastery), never bulk-completed on a teacher's word.
    if (lesson.module.strand !== Strand.DIGLIT) {
      return fail("Only digital-literacy lessons can be completed for the whole class.", 422);
    }

    // The lesson's term must be licensed (no completing an unpaid term).
    const licensedTerms = await getLicensedTermNumbers(schoolId, schoolClass.sessionLabel);
    if (!licensedTerms.has(termNumberForModule(lesson.module.sortOrder))) {
      return fail("This lesson's term is not licensed.", 403);
    }

    // The class's own roster: active pupils only.
    const pupils = await prisma.enrollment.findMany({
      where: { schoolClassId: classId, schoolId, status: EnrollmentStatus.ACTIVE },
      select: { userId: true },
    });
    if (pupils.length === 0) return ok({ completed: 0, pupils: 0 });

    // Create-only: a pupil who already completed the lesson (self or a prior mark) keeps their record.
    const result = await prisma.lessonProgress.createMany({
      data: pupils.map((p) => ({ userId: p.userId, lessonId })),
      skipDuplicates: true,
    });

    return ok({ completed: result.count, pupils: pupils.length });
  } catch (error) {
    captureError(error);
    return fail("Could not complete the lesson for the class.", 500);
  }
}

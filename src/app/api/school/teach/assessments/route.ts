import { AssessmentVerificationStatus, CourseAudience, SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense, getLicensedTermNumbers } from "@/lib/school-license";
import { termNumberForModule } from "@/lib/school-term";
import { teacherDisplayName } from "@/lib/school-teacher-history";
import { schoolScheduleAssessmentSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * The teacher's view of KAT-authored tests and exams for their class, and the scheduling of them.
 *
 * KAT authors every assessment (curriculum-in-a-box); the teacher only decides WHEN their class sits
 * one. Everything is scoped to a class this teacher actually teaches, and to that class's own course,
 * so a teacher can neither see nor schedule another class's or another course's assessments.
 *
 * GET  ?classId= -> the class's published, KAT-verified school assessments, each with its module, its
 *                   term-licence state, and whether it is currently scheduled (+ window).
 * POST           -> schedule (or, with scheduled:false, un-schedule) one assessment for the class.
 */

async function loadOwnClass(schoolId: string, teacherId: string, classId: string) {
  return prisma.schoolClass.findFirst({
    where: { id: classId, schoolId, teacherId },
    select: { id: true, sessionLabel: true, programId: true },
  });
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
  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return fail("classId is required.", 400);

  try {
    const cls = await loadOwnClass(schoolId, session!.user.id, classId);
    if (!cls) return fail("Class not found.", 404);

    const gate = await checkClassLicense(schoolId, cls.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);
    if (!cls.programId) return ok({ classId, assessments: [] });

    // KAT-authored school assessments for this class's course, ready for pupils (published + approved).
    const assessments = await prisma.assessment.findMany({
      where: {
        programId: cls.programId,
        moduleId: { not: null },
        published: true,
        verificationStatus: AssessmentVerificationStatus.APPROVED,
        program: { audience: CourseAudience.SCHOOL },
      },
      select: {
        id: true,
        title: true,
        type: true,
        totalPoints: true,
        module: { select: { id: true, title: true, sortOrder: true } },
      },
    });

    const scheduled = await prisma.schoolClassAssessment.findMany({
      where: { schoolClassId: classId },
      select: { assessmentId: true, opensAt: true, closesAt: true },
    });
    const scheduleByAssessment = new Map(scheduled.map((s) => [s.assessmentId, s]));
    const licensedTerms = await getLicensedTermNumbers(schoolId, cls.sessionLabel);

    const items = assessments
      .map((a) => {
        const termNumber = a.module ? termNumberForModule(a.module.sortOrder) : null;
        const sched = scheduleByAssessment.get(a.id);
        return {
          id: a.id,
          title: a.title,
          type: a.type,
          totalPoints: a.totalPoints,
          moduleTitle: a.module?.title ?? null,
          moduleSortOrder: a.module?.sortOrder ?? 0,
          termNumber,
          licensed: termNumber != null && licensedTerms.has(termNumber),
          scheduled: Boolean(sched),
          opensAt: sched?.opensAt ?? null,
          closesAt: sched?.closesAt ?? null,
        };
      })
      .sort((x, y) => x.moduleSortOrder - y.moduleSortOrder || x.title.localeCompare(y.title));

    return ok({ classId, assessments: items });
  } catch (error) {
    captureError(error);
    return fail("Could not load assessments.", 500);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolScheduleAssessmentSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());
  const { classId, assessmentId, scheduled, opensAt, closesAt } = parsed.data;

  if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
    return fail("The close time must be after the open time.", 422);
  }

  try {
    const cls = await loadOwnClass(schoolId, session!.user.id, classId);
    if (!cls) return fail("Class not found.", 404);

    const gate = await checkClassLicense(schoolId, cls.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);
    if (!cls.programId) return fail("That assessment is not part of this class's course.", 422);

    // The assessment must be a KAT-authored, approved school assessment for THIS class's course.
    const assessment = await prisma.assessment.findFirst({
      where: {
        id: assessmentId,
        programId: cls.programId,
        published: true,
        verificationStatus: AssessmentVerificationStatus.APPROVED,
        program: { audience: CourseAudience.SCHOOL },
      },
      select: { id: true, module: { select: { sortOrder: true } } },
    });
    if (!assessment || !assessment.module) {
      return fail("That assessment is not part of this class's course.", 422);
    }

    // Its term must be licensed, no scheduling an unpaid term.
    const licensedTerms = await getLicensedTermNumbers(schoolId, cls.sessionLabel);
    if (!licensedTerms.has(termNumberForModule(assessment.module.sortOrder))) {
      return fail("This assessment's term is not licensed.", 403);
    }

    if (!scheduled) {
      // deleteMany keeps un-scheduling idempotent and stays scoped to this class.
      await prisma.schoolClassAssessment.deleteMany({ where: { schoolClassId: classId, assessmentId } });
      return ok({ scheduled: false });
    }

    const me = await prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { firstName: true, lastName: true },
    });
    const opens = opensAt ? new Date(opensAt) : null;
    const closes = closesAt ? new Date(closesAt) : null;

    const record = await prisma.schoolClassAssessment.upsert({
      where: { schoolClassId_assessmentId: { schoolClassId: classId, assessmentId } },
      update: { opensAt: opens, closesAt: closes, assignedById: session!.user.id, assignedByName: me ? teacherDisplayName(me) : null },
      create: {
        schoolClassId: classId,
        assessmentId,
        opensAt: opens,
        closesAt: closes,
        assignedById: session!.user.id,
        assignedByName: me ? teacherDisplayName(me) : null,
      },
      select: { opensAt: true, closesAt: true },
    });

    return ok({ scheduled: true, opensAt: record.opensAt, closesAt: record.closesAt });
  } catch (error) {
    captureError(error);
    return fail("Could not schedule the assessment.", 500);
  }
}

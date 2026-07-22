import { CourseAudience, EnrollmentStatus, SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { PROGRAM_AVAILABLE } from "@/lib/program";
import { OverSeatedError, resolveClassProgram, syncRoster, type RosterCandidate } from "@/lib/roster-sync";
import { reconcileSeats } from "@/lib/school-seats";
import { recordTeacherChange, teacherDisplayName } from "@/lib/school-teacher-history";
import { schoolRolloverSchema } from "@/lib/validators";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/school/rollover, promote a class's pupils into a NEW next-session class.
 *
 * SCHOOL_ADMIN only. Creates the target class, rosters the SOURCE class's ACTIVE pupils into it via
 * THE one roster path (seat-checked against the target term's licence), then marks the source
 * enrollments COMPLETED. Pupils are matched by their EXISTING account email, never re-derived from a
 * name (a "Last, First" name would round-trip to a different synthetic email and duplicate a child).
 *
 * PROMOTION ONLY. The target course must differ from the source's (next year's programme). Repeating
 * the SAME course would collide on Enrollment @@unique([userId, programId]); that needs the deferred
 * per-session-enrollment change, so it is refused here with a clear message rather than silently
 * skipping the pupils.
 *
 * TENANT ISOLATION: schoolId comes from the session; every query is schoolId-scoped.
 */

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
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
  const parsed = schoolRolloverSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid rollover payload.", 400, parsed.error.flatten());
  }
  const { sourceClassId, name, sessionLabel, programId, nerdcLevel, teacherId } = parsed.data;

  try {
    // Source class must belong to this school.
    const source = await prisma.schoolClass.findFirst({
      where: { id: sourceClassId, schoolId },
      select: { id: true, programId: true, nerdcLevel: true, sessionLabel: true },
    });
    if (!source) return fail("Source class not found.", 404);

    // The target must be a DIFFERENT programme (promotion, not repeat).
    const sourceProgram = await resolveClassProgram(source);
    if (!("error" in sourceProgram) && sourceProgram.id === programId) {
      return fail(
        "The target course is the same as the current one. Repeating a course is not supported yet; choose the next year's course.",
        422,
      );
    }

    // Target course: an available SCHOOL programme matching the target level.
    const program = await prisma.program.findFirst({
      where: { id: programId, audience: CourseAudience.SCHOOL, ...PROGRAM_AVAILABLE },
      select: { id: true, nerdcLevel: true },
    });
    if (!program) return fail("That course is not available to assign.", 422);
    if (program.nerdcLevel !== nerdcLevel) {
      return fail("The course does not match the class level.", 422);
    }

    // Target teacher, if any, must be a TEACHER of this school.
    let teacherName: string | null = null;
    if (teacherId) {
      const membership = await prisma.schoolMembership.findUnique({
        where: { schoolId_userId: { schoolId, userId: teacherId } },
        select: { role: true, user: { select: { firstName: true, lastName: true } } },
      });
      if (membership?.role !== SchoolRole.TEACHER) {
        return fail("That teacher is not a TEACHER of this school.", 422);
      }
      teacherName = teacherDisplayName(membership.user);
    }

    // The pupils to promote: the source class's ACTIVE enrollments, matched by their exact email.
    const enrollments = await prisma.enrollment.findMany({
      where: { schoolId, schoolClassId: sourceClassId, status: EnrollmentStatus.ACTIVE },
      select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (enrollments.length === 0) {
      return fail("The source class has no active pupils to roll over.", 422);
    }

    // Create the target class (with its first teacher-history row, like the classes route).
    const targetClass = await prisma.$transaction(async (tx) => {
      const created = await tx.schoolClass.create({
        data: { schoolId, name, nerdcLevel, sessionLabel, programId, teacherId: teacherId ?? null },
        select: { id: true, name: true, sessionLabel: true },
      });
      if (teacherId) {
        await recordTeacherChange(tx, {
          schoolId,
          schoolClassId: created.id,
          teacherId,
          teacherName,
          assignedById: session!.user.id,
        });
      }
      return created;
    });

    // Roster the pupils via THE one seat-checked path. externalRef is deliberately NOT carried: the
    // source enrollment keeps it, so a null here avoids the @@unique([schoolId, externalRef]) clash.
    const candidates: RosterCandidate[] = enrollments.map((e, i) => ({
      ref: i + 1,
      name: `${e.user.firstName} ${e.user.lastName}`.trim(),
      email: e.user.email,
    }));

    let result;
    try {
      result = await syncRoster({
        schoolId,
        schoolClassId: targetClass.id,
        candidates,
        organizationId: session?.user?.organizationId,
      });
    } catch (error) {
      // Roster threw (e.g. lost the seat race). The target class is now an empty shell, remove it so
      // a retry starts clean.
      await prisma.schoolClass.delete({ where: { id: targetClass.id } });
      if (error instanceof OverSeatedError) {
        return fail("Not enough seats in the target term. Nothing was rolled over.", 422);
      }
      throw error;
    }
    if ("error" in result) {
      await prisma.schoolClass.delete({ where: { id: targetClass.id } });
      return fail(result.error, result.status);
    }

    // The source year is done for these pupils: mark their enrollments COMPLETED and reconcile the
    // source term's seat count (they no longer occupy it).
    await prisma.enrollment.updateMany({
      where: { id: { in: enrollments.map((e) => e.id) }, schoolId },
      data: { status: EnrollmentStatus.COMPLETED, completedAt: new Date() },
    });
    await reconcileSeats(schoolId, source.sessionLabel);

    await trackEvent({
      userId: session?.user?.id,
      eventType: "admin",
      eventName: "school_class_rolled_over",
      payload: { schoolId, sourceClassId, targetClassId: targetClass.id, promoted: result.created },
    });

    return ok({
      targetClass,
      promoted: result.created,
      skipped: result.skipped,
      errors: result.errors.length,
      seats: { used: result.seatsUsed, limit: result.seatLimit },
    });
  } catch (error) {
    captureError(error);
    return fail("Could not roll over the class.", 500);
  }
}

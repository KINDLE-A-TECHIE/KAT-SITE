import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkCourseAssignable } from "@/lib/school-course";
import {
  getUnattestedUnits,
  recordTeacherChange,
  teacherDisplayName,
} from "@/lib/school-teacher-history";
import { schoolClassCreateSchema, schoolClassUpdateSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * School classes. SCHOOL_ADMIN only.
 *
 * TENANT ISOLATION: `schoolId` always comes from requireActiveSchool (the session),
 * never from the request body. Every query carries `where: { schoolId }`, and the
 * PATCH scopes by schoolId in its WHERE clause so a foreign class id simply matches
 * zero rows, cross-tenant writes are structurally impossible, not merely checked.
 */

/** Maps the guard's thrown error onto the standard 401/403 responses. */
function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

/**
 * A teacher may only be assigned if they hold a TEACHER membership in THIS school.
 * Returns their display name (snapshotted into the history row), or null if not assignable.
 */
async function getAssignableTeacher(
  schoolId: string,
  teacherId: string,
): Promise<{ name: string } | null> {
  const membership = await prisma.schoolMembership.findUnique({
    where: { schoolId_userId: { schoolId, userId: teacherId } },
    select: { role: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (membership?.role !== SchoolRole.TEACHER) return null;
  return { name: teacherDisplayName(membership.user) };
}

// GET /api/school/classes, list this school's classes.
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  try {
    // Consumed by the classes panel AND the roster-import class picker, both of which need the
    // full set (no offset control). Flat safety cap only, a default page would drop classes from
    // the picker. 200 is generous for one school's classes.
    const classes = await prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        nerdcLevel: true,
        sessionLabel: true,
        teacherId: true,
        teacher: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
        createdAt: true,
      },
    });
    return ok({ classes });
  } catch (error) {
    captureError(error);
    return fail("Could not load classes.", 500);
  }
}

// POST /api/school/classes, create a class.
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

  const parsed = schoolClassCreateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid class payload.", 400, parsed.error.flatten());
  }
  const { name, nerdcLevel, sessionLabel, teacherId } = parsed.data;

  try {
    const teacher = teacherId ? await getAssignableTeacher(schoolId, teacherId) : null;
    if (teacherId && !teacher) {
      return fail("That teacher is not a TEACHER of this school.", 422);
    }

    // The class and its first history row are written together: the pointer and the audit trail
    // can never disagree, not even for the width of a failed request.
    const created = await prisma.$transaction(async (tx) => {
      const schoolClass = await tx.schoolClass.create({
        data: { schoolId, name, nerdcLevel, sessionLabel, teacherId: teacherId ?? null },
        select: { id: true, name: true, nerdcLevel: true, sessionLabel: true, teacherId: true },
      });
      if (teacherId) {
        await recordTeacherChange(tx, {
          schoolId,
          schoolClassId: schoolClass.id,
          teacherId,
          teacherName: teacher!.name,
          assignedById: session!.user.id,
        });
      }
      return schoolClass;
    });

    return ok({ class: created }, 201);
  } catch (error) {
    captureError(error);
    return fail("Could not create the class.", 500);
  }
}

// PATCH /api/school/classes, edit a class / (re)assign or clear its teacher.
export async function PATCH(request: Request) {
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

  const parsed = schoolClassUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid class payload.", 400, parsed.error.flatten());
  }
  const { id, name, nerdcLevel, sessionLabel, teacherId, programId, confirmHandover } = parsed.data;

  try {
    // TENANT ISOLATION: read the class through schoolId. A foreign id matches zero rows and
    // 404s, so nothing below can act on another school's class.
    const existing = await prisma.schoolClass.findFirst({
      where: { id, schoolId },
      select: {
        id: true,
        nerdcLevel: true,
        programId: true,
        teacherId: true,
        teacher: { select: { firstName: true, lastName: true } },
      },
    });
    if (!existing) return fail("Class not found.", 404);

    const teacher = teacherId ? await getAssignableTeacher(schoolId, teacherId) : null;
    if (teacherId && !teacher) {
      return fail("That teacher is not a TEACHER of this school.", 422);
    }

    const handingOver =
      teacherId !== undefined && teacherId !== existing.teacherId && existing.teacherId !== null;

    /*
     * THE HANDOVER GUARD.
     *
     * Reassignment revokes the outgoing teacher's access the instant it lands, the teach routes
     * scope by teacherId. Any unit she taught but never ticked becomes permanently un-attestable
     * BY HER, and the class then reports "not delivered" for teaching that genuinely happened.
     *
     * We will not paper over that by letting the incoming teacher sign the outgoing one's name;
     * that would falsify the compliance record. So the loss is made visible and deliberate: the
     * admin is shown exactly what is at risk and must confirm. The natural path is the honest one
     * ask the outgoing teacher to attest what she taught, THEN hand over.
     */
    if (handingOver && !confirmHandover) {
      const unattested = await getUnattestedUnits(schoolId, id);
      if (unattested.length > 0) {
        const outgoing = teacherDisplayName(existing.teacher ?? {
          firstName: null,
          lastName: null,
        });
        return fail(
          `${outgoing} has not attested ${unattested.length} unit${
            unattested.length === 1 ? "" : "s"
          }. Once reassigned they lose access to this class and can no longer attest the teaching they did. Ask them to mark what they taught, then hand over.`,
          409,
          {
            code: "UNATTESTED_UNITS",
            outgoingTeacher: outgoing,
            unattested, // unit titles only, no student data
          },
        );
      }
    }

    // Course assignment obeys the same rules as the teacher route (shared helper),
    // including the lock once students are enrolled.
    if (programId !== undefined) {
      const problem = await checkCourseAssignable(existing, programId);
      if (problem) return fail(problem, 422);
    }

    const updated = await prisma.$transaction(async (tx) => {
      // schoolId stays in the WHERE clause even though `existing` was already scoped, the
      // isolation is a property of every query, not of the sequence.
      await tx.schoolClass.updateMany({
        where: { id, schoolId },
        data: {
          ...(name !== undefined ? { name } : {}), ...(nerdcLevel !== undefined ? { nerdcLevel } : {}), ...(sessionLabel !== undefined ? { sessionLabel } : {}), ...(teacherId !== undefined ? { teacherId } : {}), // null clears the assignment
          ...(programId !== undefined ? { programId } : {}),
        },
      });

      // The pointer moved; record WHO held the class and until when. Attestations already made
      // are deliberately left untouched and attributed to whoever made them.
      if (teacherId !== undefined) {
        await recordTeacherChange(tx, {
          schoolId,
          schoolClassId: id,
          teacherId: teacherId ?? null,
          teacherName: teacher?.name ?? null,
          assignedById: session!.user.id,
        });
      }

      return tx.schoolClass.findFirst({
        where: { id, schoolId },
        select: { id: true, name: true, nerdcLevel: true, sessionLabel: true, teacherId: true },
      });
    });

    return ok({ class: updated });
  } catch (error) {
    captureError(error);
    return fail("Could not update the class.", 500);
  }
}

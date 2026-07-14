import "server-only";
import { prisma } from "./prisma";

/**
 * Teacher handover for a school class.
 *
 * A class changes hands mid-term, a teacher resigns, goes on leave, the timetable is
 * reshuffled. Three things must survive that, and one thing must NOT happen.
 *
 * MUST SURVIVE
 *   1. Student progress. It is keyed by userId and belongs to the STUDENTS, not the teacher.
 *      It is never touched here. There is nothing to "transfer".
 *   2. Delivery attestations (SchoolClassUnit). Keyed by schoolClassId + moduleId, so they
 *      already outlive the teacher who made them.
 *   3. The knowledge that the class HAD another teacher, which, before this module, was lost
 *      the instant SchoolClass.teacherId was overwritten.
 *
 * MUST NOT HAPPEN
 *   Re-attributing the outgoing teacher's attestations to the incoming one. The entire value of
 *   an attestation is that a NAMED HUMAN stands behind it. Rewriting that name to someone who
 *   did not make the claim would falsify the compliance record the report exists to be. So
 *   attestations are left exactly where they are, and the teacher history below is what tells an
 *   inspector who held the class when.
 *
 * AUTHORIZATION: none of these functions authorize. Callers must have already resolved schoolId
 * from the session (requireActiveSchool), never from the request.
 */

/**
 * Just the delegate this module writes through. Picked off the real (extended) client rather than
 * typed as Prisma.TransactionClient, the extended client's transaction callback hands back an
 * Omit<> of itself, which is not assignable to the vanilla TransactionClient. Same reason
 * school-seats.ts narrows to Pick<typeof prisma, "$executeRaw">.
 */
type Db = Pick<typeof prisma, "schoolClassTeacher">;

export type TeacherTerm = {
  teacherName: string;
  from: string;
  /** Null = still holds the class. */
  to: string | null;
};

export function teacherDisplayName(u: { firstName: string | null; lastName: string | null }): string {
  return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "Unnamed teacher";
}

/**
 * Records a teacher change: closes whoever currently holds the class and opens a row for the
 * incoming teacher (if any, a null teacherId simply unassigns).
 *
 * Idempotent: reassigning the same teacher leaves the open row alone, so an admin re-saving a
 * class form does not shred the history into one-second slices.
 *
 * Call INSIDE the same transaction as the SchoolClass update, so the pointer and the history can
 * never disagree.
 */
export async function recordTeacherChange(
  db: Db,
  params: {
    schoolId: string;
    schoolClassId: string;
    /** Null unassigns the class. */
    teacherId: string | null;
    teacherName: string | null;
    assignedById: string;
  },
): Promise<void> {
  const { schoolId, schoolClassId, teacherId, teacherName, assignedById } = params;

  // TENANT ISOLATION: schoolId in the WHERE clause, even though schoolClassId alone would be
  // unique, a school-scoped table is never queried without it.
  const open = await db.schoolClassTeacher.findFirst({
    where: { schoolId, schoolClassId, unassignedAt: null },
    select: { id: true, teacherId: true },
  });

  if (open?.teacherId === teacherId) return; // no change

  const now = new Date();

  if (open) {
    await db.schoolClassTeacher.update({
      where: { id: open.id },
      data: { unassignedAt: now },
    });
  }

  if (teacherId) {
    await db.schoolClassTeacher.create({
      data: {
        schoolId,
        schoolClassId,
        teacherId,
        teacherName: teacherName ?? "Unnamed teacher",
        assignedAt: now,
        assignedById,
      },
    });
  }
}

/** Who taught this class, oldest first. Drives the "Taught by …" line on the report. */
export async function getTeacherHistory(
  schoolId: string,
  schoolClassId: string,
): Promise<TeacherTerm[]> {
  const rows = await prisma.schoolClassTeacher.findMany({
    where: { schoolId, schoolClassId },
    orderBy: { assignedAt: "asc" },
    select: { teacherName: true, assignedAt: true, unassignedAt: true },
  });

  return rows.map((r) => ({
    teacherName: r.teacherName,
    from: r.assignedAt.toISOString(),
    to: r.unassignedAt?.toISOString() ?? null,
  }));
}

/**
 * The teacher who held this class immediately BEFORE the current one, if any.
 *
 * Derived from the history, never accepted from the client, a teacher who could name her own
 * predecessor in the request body could credit anyone at all with teaching she cannot vouch for.
 * Returns null when the class has never changed hands, which is what makes a SUCCESSOR claim
 * impossible on such a class.
 */
export async function getPredecessor(
  schoolId: string,
  schoolClassId: string,
): Promise<{ teacherName: string } | null> {
  const previous = await prisma.schoolClassTeacher.findFirst({
    where: { schoolId, schoolClassId, unassignedAt: { not: null } },
    orderBy: { unassignedAt: "desc" },
    select: { teacherName: true },
  });
  return previous ?? null;
}

export type UnattestedUnit = { moduleId: string; order: number; label: string };

/**
 * The units the OUTGOING teacher has taught but not yet attested, everything on the class's
 * course that carries no delivery mark.
 *
 * This is the whole point of the handover guard. Reassignment revokes the outgoing teacher's
 * access immediately (teach routes scope by teacherId), so any unit they taught but never ticked
 * becomes permanently un-attestable BY THEM. The class then reports "not delivered" for teaching
 * that genuinely happened, and the school looks non-compliant.
 *
 * We cannot fix that after the fact without letting someone else sign their name, which is
 * exactly the falsification we refuse. So we surface it BEFORE the change and make the admin
 * choose.
 */
export async function getUnattestedUnits(
  schoolId: string,
  schoolClassId: string,
): Promise<UnattestedUnit[]> {
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: schoolClassId, schoolId },
    select: { programId: true },
  });
  if (!schoolClass?.programId) return []; // no course assigned: nothing was deliverable

  const [curriculum, delivered] = await Promise.all([
    prisma.curriculum.findUnique({
      where: { programId: schoolClass.programId },
      select: {
        versions: {
          where: { isActive: true },
          take: 1,
          select: {
            modules: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, title: true, sortOrder: true },
            },
          },
        },
      },
    }),
    prisma.schoolClassUnit.findMany({
      where: { schoolClassId, deliveredAt: { not: null } },
      select: { moduleId: true },
    }),
  ]);

  const attested = new Set(delivered.map((d) => d.moduleId));

  return (curriculum?.versions[0]?.modules ?? [])
    .filter((m) => !attested.has(m.id))
    .map((m) => ({ moduleId: m.id, order: m.sortOrder + 1, label: m.title }));
}

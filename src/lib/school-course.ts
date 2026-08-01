import "server-only";
import { CourseAudience, NerdcLevel } from "@prisma/client";
import { prisma } from "./prisma";
import { PROGRAM_AVAILABLE } from "./program";

/**
 * Rules for assigning a SCHOOL course to a class. Shared by the teacher route and
 * the school-admin route so the lock below cannot be enforced in one and quietly
 * forgotten in the other.
 *
 * Returns an error message, or null if the assignment is allowed.
 */
export async function checkCourseAssignable(
  schoolClass: { id: string; nerdcLevel: NerdcLevel; programId: string | null },
  programId: string | null,
): Promise<string | null> {
  // No-op assignment is always fine.
  if (schoolClass.programId === programId) return null;

  // THE LOCK: Enrollment.programId anchors every lesson completion, module gate and
  // assessment a child has. Re-pointing the class at a different course would strand
  // that progress (and can collide with Enrollment's unique [userId, programId]).
  // So the course is fixed once anyone is enrolled.
  const enrolled = await prisma.enrollment.count({ where: { schoolClassId: schoolClass.id } });
  if (enrolled > 0) {
    return "This class already has students enrolled, so its course can no longer be changed.";
  }

  // Unassigning an empty class is fine.
  if (programId === null) return null;

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { audience: true, nerdcLevel: true, isActive: true, isPublished: true },
  });
  if (!program) return "That course does not exist.";
  if (program.audience !== CourseAudience.SCHOOL) {
    return "Only school courses can be assigned to a class.";
  }
  if (program.nerdcLevel !== schoolClass.nerdcLevel) {
    return `That course is not for ${schoolClass.nerdcLevel.replace(/_/g, " ")}.`;
  }
  // A draft or archived course can't be assigned; publish it first.
  if (!program.isActive || !program.isPublished) {
    return "That course is not published yet.";
  }

  return null;
}

/** SCHOOL courses available for a given NERDC level (drives the picker). */
export async function listCoursesForLevel(nerdcLevel: NerdcLevel) {
  return prisma.program.findMany({
    where: { audience: CourseAudience.SCHOOL, nerdcLevel, ...PROGRAM_AVAILABLE },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

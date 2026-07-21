import "server-only";
import { Strand, type AttestationBasis } from "@prisma/client";
import { prisma } from "./prisma";
import { NERDC_COURSES, type NerdcCourse } from "./nerdc-crosswalk";
import { getTeacherHistory, type TeacherTerm } from "./school-teacher-history";

/**
 * NERDC coverage for a school class, measured against the crosswalk.
 *
 * THREE FIGURES, KEPT SEPARATE ON PURPOSE. A school may hand this report to an
 * inspector, so each number must say exactly what it is and who stands behind it.
 * Blending them into one "coverage %" would dress a student-engagement number up as
 * evidence of teaching.
 *
 *   1. SCHEME COVERAGE (structural), does the platform carry every topic the NERDC
 *      scheme lists for this course? Objective; a property of the curriculum, not of
 *      the class. For seeded NERDC courses this is 100% by construction, and proving
 *      it is the compliance claim KAT sells.
 *
 *   2. DELIVERED (teacher-attested), units the TEACHER has marked as delivered
 *      (SchoolClassUnit). This is the only record of teaching in the system, and the
 *      only figure that honestly answers "did we cover the syllabus?".
 *
 *   3. STUDENT ENGAGEMENT, derived from lesson completions. It measures what students
 *      worked through, NOT what was taught. A brilliantly taught unit whose students
 *      never ticked the boxes reads as 0% here; that is precisely why it must never be
 *      presented as delivery.
 *
 * AUTHORIZATION: none. The caller must already have authorized the class (schoolId,
 * plus teacherId for a teacher).
 */

export type UnitCoverage = {
  moduleId: string;
  order: number;
  label: string;
  strand: Strand;
  /** Topics the NERDC scheme lists for this unit. Null when the course isn't a crosswalk course. */
  topicsInScheme: number | null;
  /** Lessons the platform actually carries for this unit. */
  topicsOnPlatform: number;
  /** 1. Structural: platform vs scheme. Null when not a crosswalk course. */
  schemeCoveragePct: number | null;
  /** 2. Teacher-attested. */
  delivered: boolean;
  deliveredAt: string | null;
  /** Who ATTESTED, not necessarily who taught. Read with `basis`. */
  deliveredBy: string | null;
  /**
   * FIRST_HAND = the attester taught it. SUCCESSOR = the attester inherited the class and is
   * recording that `taughtByName` taught it, a weaker, second-hand claim, and shown as one.
   */
  basis: AttestationBasis | null;
  /** For SUCCESSOR: the predecessor being credited. */
  taughtByName: string | null;
  /** 3. Student engagement: completions vs (topics x students). */
  engagementPct: number;
  avgCompletedPerStudent: number;
};

export type ClassCoverage = {
  classId: string;
  className: string;
  sessionLabel: string;
  course: { id: string; name: string; slug: string } | null;
  /** False when the class's course is not one of the NERDC crosswalk courses. */
  matchedCrosswalk: boolean;
  studentCount: number;
  /**
   * Who held this class, and when. A class can change hands mid-term; naming only the current
   * teacher would imply she taught the whole of it. Read alongside each unit's `deliveredBy`:
   * this says who held the class, that says who vouched for the teaching.
   */
  teachers: TeacherTerm[];
  units: UnitCoverage[];
  totals: {
    unitsInScheme: number | null;
    unitsOnPlatform: number;
    /** Structural coverage across the whole course. Null when not a crosswalk course. */
    schemeCoveragePct: number | null;
    /** All attested units, of any basis. Never present this without the split below. */
    unitsDelivered: number;
    /** Attested by the teacher who taught them. */
    unitsFirstHand: number;
    /** Recorded by a successor on a predecessor's behalf, second-hand evidence. */
    unitsSuccessor: number;
    deliveredPct: number;
    engagementPct: number;
  };
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

function crosswalkFor(slug: string | undefined): NerdcCourse | undefined {
  if (!slug) return undefined;
  return NERDC_COURSES.find((c) => c.slug === slug);
}

export async function getClassCoverage(
  schoolId: string,
  schoolClassId: string,
): Promise<ClassCoverage | null> {
  // TENANT ISOLATION: schoolId in the WHERE clause.
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: schoolClassId, schoolId },
    select: {
      id: true,
      name: true,
      sessionLabel: true,
      programId: true,
      program: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!schoolClass) return null;

  const teachers = await getTeacherHistory(schoolId, schoolClassId);

  const empty: ClassCoverage = {
    classId: schoolClass.id,
    className: schoolClass.name,
    sessionLabel: schoolClass.sessionLabel,
    course: schoolClass.program,
    matchedCrosswalk: false,
    studentCount: 0,
    teachers,
    units: [],
    totals: {
      unitsInScheme: null,
      unitsOnPlatform: 0,
      schemeCoveragePct: null,
      unitsDelivered: 0,
      unitsFirstHand: 0,
      unitsSuccessor: 0,
      deliveredPct: 0,
      engagementPct: 0,
    },
  };

  if (!schoolClass.programId) return empty;

  const crosswalk = crosswalkFor(schoolClass.program?.slug);

  const [curriculum, enrollments, deliveries] = await Promise.all([
    prisma.curriculum.findUnique({
      where: { programId: schoolClass.programId },
      select: {
        versions: {
          where: { isActive: true },
          take: 1,
          select: {
            modules: {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                title: true,
                strand: true,
                sortOrder: true,
                lessons: { select: { id: true } },
              },
            },
          },
        },
      },
    }),
    prisma.enrollment.findMany({
      where: { schoolId, schoolClassId },
      select: { userId: true },
    }),
    prisma.schoolClassUnit.findMany({
      where: { schoolClassId },
      select: {
        moduleId: true,
        deliveredAt: true,
        markedByName: true,
        basis: true,
        taughtByName: true,
        markedBy: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const modules = curriculum?.versions[0]?.modules ?? [];
  const userIds = enrollments.map((e) => e.userId);
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

  const moduleOfLesson = new Map<string, string>();
  for (const m of modules) for (const l of m.lessons) moduleOfLesson.set(l.id, m.id);

  const completions =
    userIds.length > 0 && lessonIds.length > 0
      ? await prisma.lessonProgress.findMany({
          where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
          select: { lessonId: true },
        })
      : [];

  const completionsByModule = new Map<string, number>();
  for (const c of completions) {
    const moduleId = moduleOfLesson.get(c.lessonId);
    if (moduleId) completionsByModule.set(moduleId, (completionsByModule.get(moduleId) ?? 0) + 1);
  }

  const deliveryByModule = new Map(deliveries.map((d) => [d.moduleId, d]));

  const units: UnitCoverage[] = modules.map((m) => {
    // The seeded courses map Module.sortOrder = unit.order - 1, so the match is exact.
    const schemeUnit = crosswalk?.units.find((u) => u.order - 1 === m.sortOrder);
    const topicsInScheme = schemeUnit ? schemeUnit.topics.length : null;
    const topicsOnPlatform = m.lessons.length;

    const delivery = deliveryByModule.get(m.id);
    const completed = completionsByModule.get(m.id) ?? 0;
    const denominator = topicsOnPlatform * userIds.length;

    return {
      moduleId: m.id,
      order: m.sortOrder + 1,
      label: m.title,
      strand: m.strand ?? Strand.CODING,
      topicsInScheme,
      topicsOnPlatform,
      schemeCoveragePct:
        topicsInScheme !== null ? Math.min(100, pct(topicsOnPlatform, topicsInScheme)) : null,
      delivered: Boolean(delivery?.deliveredAt),
      deliveredAt: delivery?.deliveredAt?.toISOString() ?? null,
      // The snapshot wins: it is the name the attester signed AT THE TIME, which is what the
      // record claims. The live join is only a fallback for rows attested before the snapshot
      // column existed.
      deliveredBy:
        delivery?.markedByName ??
        (delivery?.markedBy
          ? `${delivery.markedBy.firstName} ${delivery.markedBy.lastName}`.trim()
          : null),
      basis: delivery?.basis ?? null,
      taughtByName: delivery?.taughtByName ?? null,
      engagementPct: pct(completed, denominator),
      avgCompletedPerStudent:
        userIds.length > 0 ? Math.round((completed / userIds.length) * 10) / 10 : 0,
    };
  });

  const totalTopicsInScheme = crosswalk
    ? crosswalk.units.reduce((n, u) => n + u.topics.length, 0)
    : null;
  const totalTopicsOnPlatform = modules.reduce((n, m) => n + m.lessons.length, 0);
  const unitsDelivered = units.filter((u) => u.delivered).length;
  // Split, never blended, same discipline as keeping delivery apart from engagement. A unit a
  // successor recorded on a predecessor's behalf is weaker evidence than one its own teacher
  // attested, and a total that hides the difference is a total that misleads.
  const unitsFirstHand = units.filter((u) => u.delivered && u.basis !== "SUCCESSOR").length;
  const unitsSuccessor = units.filter((u) => u.delivered && u.basis === "SUCCESSOR").length;
  const totalCompletions = completions.length;

  return {
    classId: schoolClass.id,
    className: schoolClass.name,
    sessionLabel: schoolClass.sessionLabel,
    course: schoolClass.program,
    matchedCrosswalk: Boolean(crosswalk),
    studentCount: userIds.length,
    teachers,
    units,
    totals: {
      unitsInScheme: crosswalk ? crosswalk.units.length : null,
      unitsOnPlatform: modules.length,
      schemeCoveragePct:
        totalTopicsInScheme !== null
          ? Math.min(100, pct(totalTopicsOnPlatform, totalTopicsInScheme))
          : null,
      unitsDelivered,
      unitsFirstHand,
      unitsSuccessor,
      deliveredPct: pct(unitsDelivered, modules.length),
      engagementPct: pct(totalCompletions, totalTopicsOnPlatform * userIds.length),
    },
  };
}

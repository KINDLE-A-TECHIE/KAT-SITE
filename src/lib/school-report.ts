import "server-only";
import { AssessmentVerificationStatus, AttemptStatus, GateStatus, Strand } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Class results + per-student mastery for a school class.
 *
 * Built entirely on the EXISTING assessment/CBT and progress records. LessonProgress,
 * ModuleGateStatus, Assessment, AssessmentSubmission. There is no school-specific
 * results engine: a school student's mastery is the same object as any other student's.
 * This module only AGGREGATES.
 *
 * It is also the payload the Phase 4 termly report renders, hence the per-term shape.
 * "Term" here means the COURSE's term-module (Term 1 / 2 / 3 of the scheme of work),
 * that is what actually holds the lessons, gates and assessments. The class's own
 * `term` string is its academic-term label and rides along untouched.
 *
 * Everything is batched: one query per concern, never N per student.
 *
 * AUTHORIZATION: none. The caller must already have authorized the class (schoolId,
 * plus teacherId for a teacher). This function trusts the ids it is given.
 */

/** Only assessments a student can actually sit are counted, the same rule the learner API uses. */
const STUDENT_VISIBLE_ASSESSMENT = {
  published: true,
  verificationStatus: AssessmentVerificationStatus.APPROVED,
} as const;

export type AssessmentResult = {
  id: string;
  title: string;
  totalPoints: number;
  passScore: number;
  /** Students with at least one submission. */
  submitted: number;
  /** Students with at least one GRADED submission. */
  graded: number;
  /** Mean of each student's BEST graded score, as a percentage. Null when none graded. */
  avgPct: number | null;
  /** Share of graded students whose best score met passScore. Null when none graded. */
  passRate: number | null;
};

export type StudentModuleMastery = {
  moduleId: string;
  assessmentGate: GateStatus;
  projectGate: GateStatus;
  instructorGate: GateStatus;
  allGatesPassed: boolean;
};

export type StudentSummary = {
  userId: string;
  firstName: string;
  lastName: string;
  lessonsCompleted: number;
  gatesPassed: number;
  assessmentsTaken: number;
  /** Mean of best graded scores across all assessments taken. Null if never graded. */
  avgScorePct: number | null;
  /** Most recent graded score. Null if never graded. */
  lastScorePct: number | null;
  modules: StudentModuleMastery[];
};

export type TermSummary = {
  moduleId: string;
  label: string;
  strand: Strand;
  lessons: { total: number; avgCompleted: number; completionPct: number };
  /**
   * Gates are a CODING-strand concept. DIGLIT units are slides/worksheets,
   * read and mark complete, so mastery is null for them, exactly as in /learn.
   */
  mastery: { studentsAllGatesPassed: number } | null;
  assessments: AssessmentResult[];
};

export type ClassTermSummary = {
  class: { id: string; name: string; term: string; nerdcLevel: string };
  course: { id: string; name: string } | null;
  studentCount: number;
  /** Total lessons across the whole course, 0 when no curriculum is published. */
  totalLessons: number;
  terms: TermSummary[];
  students: StudentSummary[];
};

const NO_GATES: Omit<StudentModuleMastery, "moduleId"> = {
  assessmentGate: GateStatus.NOT_STARTED,
  projectGate: GateStatus.NOT_STARTED,
  instructorGate: GateStatus.NOT_STARTED,
  allGatesPassed: false,
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export async function getClassTermSummary(
  schoolId: string,
  schoolClassId: string,
): Promise<ClassTermSummary | null> {
  // TENANT ISOLATION: the class is re-read with schoolId in the WHERE clause.
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: schoolClassId, schoolId },
    select: {
      id: true,
      name: true,
      term: true,
      nerdcLevel: true,
      programId: true,
      program: { select: { id: true, name: true } },
    },
  });
  if (!schoolClass) return null;

  // Roster, scoped by schoolId AND schoolClassId.
  const enrollments = await prisma.enrollment.findMany({
    where: { schoolId, schoolClassId },
    select: { userId: true, user: { select: { firstName: true, lastName: true } } },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });
  const userIds = enrollments.map((e) => e.userId);

  const base: ClassTermSummary = {
    class: {
      id: schoolClass.id,
      name: schoolClass.name,
      term: schoolClass.term,
      nerdcLevel: schoolClass.nerdcLevel,
    },
    course: schoolClass.program,
    studentCount: enrollments.length,
    totalLessons: 0,
    terms: [],
    students: enrollments.map((e) => ({
      userId: e.userId,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      lessonsCompleted: 0,
      gatesPassed: 0,
      assessmentsTaken: 0,
      avgScorePct: null,
      lastScorePct: null,
      modules: [],
    })),
  };

  // No course assigned, or no students → nothing to aggregate, but the class is real.
  if (!schoolClass.programId) return base;

  const programId = schoolClass.programId;

  const curriculum = await prisma.curriculum.findUnique({
    where: { programId },
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
              lessons: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  const modules = curriculum?.versions[0]?.modules ?? [];
  const moduleIds = modules.map((m) => m.id);
  const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const moduleOfLesson = new Map<string, string>();
  for (const m of modules) for (const l of m.lessons) moduleOfLesson.set(l.id, m.id);

  base.totalLessons = lessonIds.length;

  // Only assessments the students can actually sit.
  const assessments = await prisma.assessment.findMany({
    where: { programId, ...STUDENT_VISIBLE_ASSESSMENT },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, moduleId: true, totalPoints: true, passScore: true },
  });

  // A class with no students still reports its structure (empty results), so the
  // teacher sees the shape of the term rather than a blank page.
  const [lessonRows, gateRows, submissionRows] = await Promise.all([
    userIds.length > 0 && lessonIds.length > 0
      ? prisma.lessonProgress.findMany({
          where: { userId: { in: userIds }, lessonId: { in: lessonIds } },
          select: { userId: true, lessonId: true },
        })
      : Promise.resolve([] as Array<{ userId: string; lessonId: string }>),

    userIds.length > 0 && moduleIds.length > 0
      ? prisma.moduleGateStatus.findMany({
          where: { userId: { in: userIds }, moduleId: { in: moduleIds } },
          select: {
            userId: true,
            moduleId: true,
            assessmentGate: true,
            projectGate: true,
            instructorGate: true,
            allGatesPassed: true,
          },
        })
      : Promise.resolve([] as Array<StudentModuleMastery & { userId: string }>),

    userIds.length > 0 && assessments.length > 0
      ? prisma.assessmentSubmission.findMany({
          where: { studentId: { in: userIds }, assessmentId: { in: assessments.map((a) => a.id) } },
          orderBy: { submittedAt: "desc" },
          select: {
            assessmentId: true,
            studentId: true,
            status: true,
            totalScore: true,
            submittedAt: true,
          },
        })
      : Promise.resolve(
          [] as Array<{
            assessmentId: string;
            studentId: string;
            status: AttemptStatus;
            totalScore: number;
            submittedAt: Date;
          }>,
        ),
  ]);

  // ── Lessons, per student and per module ────────────────────────────────────
  const lessonsByUser = new Map<string, number>();
  const lessonsByUserModule = new Map<string, number>(); // `${userId}:${moduleId}`
  for (const row of lessonRows) {
    lessonsByUser.set(row.userId, (lessonsByUser.get(row.userId) ?? 0) + 1);
    const moduleId = moduleOfLesson.get(row.lessonId);
    if (moduleId) {
      const key = `${row.userId}:${moduleId}`;
      lessonsByUserModule.set(key, (lessonsByUserModule.get(key) ?? 0) + 1);
    }
  }

  // ── Gates ──────────────────────────────────────────────────────────────────
  const gateByUserModule = new Map<string, StudentModuleMastery>();
  const gatesPassedByUser = new Map<string, number>();
  const allPassedByModule = new Map<string, number>();
  for (const g of gateRows) {
    gateByUserModule.set(`${g.userId}:${g.moduleId}`, {
      moduleId: g.moduleId,
      assessmentGate: g.assessmentGate,
      projectGate: g.projectGate,
      instructorGate: g.instructorGate,
      allGatesPassed: g.allGatesPassed,
    });
    if (g.allGatesPassed) {
      gatesPassedByUser.set(g.userId, (gatesPassedByUser.get(g.userId) ?? 0) + 1);
      allPassedByModule.set(g.moduleId, (allPassedByModule.get(g.moduleId) ?? 0) + 1);
    }
  }

  // ── Submissions ────────────────────────────────────────────────────────────
  // Multiple attempts are allowed, so a student's result for an assessment is their
  // BEST graded score. "did they master it", not "did they nail it first time".
  const assessmentById = new Map(assessments.map((a) => [a.id, a]));
  const bestByUserAssessment = new Map<string, number>(); // `${userId}:${assessmentId}` → score
  const submittedByAssessment = new Map<string, Set<string>>();
  const gradedByAssessment = new Map<string, Set<string>>();
  const takenByUser = new Map<string, Set<string>>();
  const latestGradedByUser = new Map<string, { at: number; pctScore: number }>();

  for (const s of submissionRows) {
    const assessment = assessmentById.get(s.assessmentId);
    if (!assessment) continue;

    if (!submittedByAssessment.has(s.assessmentId)) submittedByAssessment.set(s.assessmentId, new Set());
    submittedByAssessment.get(s.assessmentId)!.add(s.studentId);

    if (!takenByUser.has(s.studentId)) takenByUser.set(s.studentId, new Set());
    takenByUser.get(s.studentId)!.add(s.assessmentId);

    if (s.status !== AttemptStatus.GRADED) continue;

    if (!gradedByAssessment.has(s.assessmentId)) gradedByAssessment.set(s.assessmentId, new Set());
    gradedByAssessment.get(s.assessmentId)!.add(s.studentId);

    const key = `${s.studentId}:${s.assessmentId}`;
    const prev = bestByUserAssessment.get(key);
    if (prev === undefined || s.totalScore > prev) bestByUserAssessment.set(key, s.totalScore);

    // Rows are ordered newest-first, so the first graded row seen per student is latest.
    if (assessment.totalPoints > 0 && !latestGradedByUser.has(s.studentId)) {
      latestGradedByUser.set(s.studentId, {
        at: s.submittedAt.getTime(),
        pctScore: pct(s.totalScore, assessment.totalPoints),
      });
    }
  }

  // ── Per-assessment results ─────────────────────────────────────────────────
  const resultFor = (a: (typeof assessments)[number]): AssessmentResult => {
    const gradedUsers = [...(gradedByAssessment.get(a.id) ?? [])];
    const bests = gradedUsers.map((u) => bestByUserAssessment.get(`${u}:${a.id}`) ?? 0);
    const passed = bests.filter((score) => score >= a.passScore).length;

    return {
      id: a.id,
      title: a.title,
      totalPoints: a.totalPoints,
      passScore: a.passScore,
      submitted: submittedByAssessment.get(a.id)?.size ?? 0,
      graded: gradedUsers.length,
      avgPct:
        gradedUsers.length > 0 && a.totalPoints > 0
          ? Math.round(
              bests.reduce((sum, score) => sum + pct(score, a.totalPoints), 0) / gradedUsers.length,
            )
          : null,
      passRate: gradedUsers.length > 0 ? pct(passed, gradedUsers.length) : null,
    };
  };

  // ── Terms ──────────────────────────────────────────────────────────────────
  base.terms = modules.map((m) => {
    const total = m.lessons.length;
    const completedAcross = userIds.reduce(
      (sum, u) => sum + (lessonsByUserModule.get(`${u}:${m.id}`) ?? 0),
      0,
    );
    const avgCompleted =
      userIds.length > 0 ? Math.round((completedAcross / userIds.length) * 10) / 10 : 0;
    const isCoding = m.strand === Strand.CODING;

    return {
      moduleId: m.id,
      label: m.title,
      strand: m.strand ?? Strand.CODING,
      lessons: {
        total,
        avgCompleted,
        completionPct: userIds.length > 0 ? pct(completedAcross, total * userIds.length) : 0,
      },
      mastery: isCoding ? { studentsAllGatesPassed: allPassedByModule.get(m.id) ?? 0 } : null,
      assessments: assessments.filter((a) => a.moduleId === m.id).map(resultFor),
    };
  });

  // Assessments that belong to the course rather than a term-module are appended
  // as a course-wide bucket, so they are never silently dropped from the report.
  const courseWide = assessments.filter((a) => a.moduleId === null);
  if (courseWide.length > 0) {
    base.terms.push({
      moduleId: "course-wide",
      label: "Course-wide assessments",
      strand: Strand.CODING,
      lessons: { total: 0, avgCompleted: 0, completionPct: 0 },
      mastery: null,
      assessments: courseWide.map(resultFor),
    });
  }

  // ── Per-student ────────────────────────────────────────────────────────────
  base.students = base.students.map((s) => {
    const taken = [...(takenByUser.get(s.userId) ?? [])];
    const gradedPcts = taken
      .map((assessmentId) => {
        const a = assessmentById.get(assessmentId);
        const best = bestByUserAssessment.get(`${s.userId}:${assessmentId}`);
        return a && a.totalPoints > 0 && best !== undefined ? pct(best, a.totalPoints) : null;
      })
      .filter((p): p is number => p !== null);

    return {
      ...s,
      lessonsCompleted: lessonsByUser.get(s.userId) ?? 0,
      gatesPassed: gatesPassedByUser.get(s.userId) ?? 0,
      assessmentsTaken: taken.length,
      avgScorePct:
        gradedPcts.length > 0
          ? Math.round(gradedPcts.reduce((a, b) => a + b, 0) / gradedPcts.length)
          : null,
      lastScorePct: latestGradedByUser.get(s.userId)?.pctScore ?? null,
      // Only CODING modules carry gates; an un-started one reports NOT_STARTED
      // rather than being absent, so the UI can distinguish "no gate" from "not begun".
      modules: modules
        .filter((m) => (m.strand ?? Strand.CODING) === Strand.CODING)
        .map(
          (m) =>
            gateByUserModule.get(`${s.userId}:${m.id}`) ?? { moduleId: m.id, ...NO_GATES },
        ),
    };
  });

  return base;
}

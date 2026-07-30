import { AssessmentType, AttemptStatus, AssessmentVerificationStatus, CourseAudience, GateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PASS_MARK, gradeFor, weightedPercent } from "@/lib/practical-grading";
import { termNumberForModule } from "@/lib/school-term";

/**
 * A pupil's result for one module (= one term), Nigerian-style: continuous assessment (tests, quizzes,
 * assignments) plus a terminal exam, each weighted into a single percentage and grade. This is the
 * number a report card carries and the signal the assessment gate reads.
 *
 * Weights are fixed sensible defaults for now (school-configurable later). Only GRADED submissions count,
 * so a term in progress reports on what has actually been marked.
 */

export const SCHOOL_CA_WEIGHT = 40;
export const SCHOOL_EXAM_WEIGHT = 60;

export type TermResult = {
  ca: { earned: number; total: number };
  exam: { earned: number; total: number };
  percent: number;
  grade: string;
  passed: boolean;
  /** False when nothing in this module has been graded yet (so there is no result to show). */
  hasResult: boolean;
};

// EXAM is the terminal exam; everything else a school assessment can be (QUIZ, ASSIGNMENT, ...) is
// continuous assessment.
function isExam(type: AssessmentType): boolean {
  return type === AssessmentType.EXAM;
}

type Bucket = { earned: number; total: number };

/** Combine a pupil's continuous-assessment and exam buckets into the weighted term result. Pure. */
export function termResultFrom(ca: Bucket, exam: Bucket): TermResult {
  const percent = weightedPercent([
    { earned: ca.earned, total: ca.total, weight: SCHOOL_CA_WEIGHT },
    { earned: exam.earned, total: exam.total, weight: SCHOOL_EXAM_WEIGHT },
  ]);
  const hasResult = ca.total > 0 || exam.total > 0;
  return {
    ca,
    exam,
    percent,
    grade: gradeFor(percent),
    passed: hasResult && percent >= DEFAULT_PASS_MARK,
    hasResult,
  };
}

export async function computeTermResult(userId: string, moduleId: string): Promise<TermResult> {
  const assessments = await prisma.assessment.findMany({
    where: { moduleId, program: { audience: CourseAudience.SCHOOL } },
    select: { id: true, type: true, totalPoints: true },
  });

  const byId = new Map(assessments.map((a) => [a.id, a]));
  const subs = assessments.length
    ? await prisma.assessmentSubmission.findMany({
        where: {
          studentId: userId,
          assessmentId: { in: assessments.map((a) => a.id) },
          status: AttemptStatus.GRADED,
        },
        select: { assessmentId: true, totalScore: true },
      })
    : [];

  const ca = { earned: 0, total: 0 };
  const exam = { earned: 0, total: 0 };
  for (const s of subs) {
    const a = byId.get(s.assessmentId);
    if (!a) continue;
    const bucket = isExam(a.type) ? exam : ca;
    bucket.earned += s.totalScore;
    bucket.total += a.totalPoints;
  }

  return termResultFrom(ca, exam);
}

export type ClassTermResults = {
  modules: { id: string; title: string; termNumber: number }[];
  pupils: { userId: string; firstName: string; lastName: string; results: Record<string, TermResult> }[];
};

/**
 * Every pupil's term result for every module of a class, batched (a few queries, not N per pupil).
 * Reuses the same CA/EXAM bucketing as computeTermResult. The caller must already have authorized the
 * class (schoolId + teacherId); this only aggregates.
 */
export async function computeClassTermResults(classId: string): Promise<ClassTermResults> {
  const cls = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { programId: true } });

  const enrollments = await prisma.enrollment.findMany({
    where: { schoolClassId: classId },
    select: { userId: true, user: { select: { firstName: true, lastName: true } } },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  const curriculum = cls?.programId
    ? await prisma.curriculum.findUnique({
        where: { programId: cls.programId },
        select: {
          versions: {
            where: { isActive: true },
            take: 1,
            select: { modules: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, sortOrder: true } } },
          },
        },
      })
    : null;
  const modules = curriculum?.versions[0]?.modules ?? [];
  const moduleIds = modules.map((m) => m.id);
  const userIds = enrollments.map((e) => e.userId);

  const moduleOut = modules.map((m) => ({ id: m.id, title: m.title, termNumber: termNumberForModule(m.sortOrder) }));
  const empty = () => Object.fromEntries(modules.map((m) => [m.id, termResultFrom({ earned: 0, total: 0 }, { earned: 0, total: 0 })]));

  if (moduleIds.length === 0 || userIds.length === 0) {
    return {
      modules: moduleOut,
      pupils: enrollments.map((e) => ({ userId: e.userId, firstName: e.user.firstName, lastName: e.user.lastName, results: empty() })),
    };
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      moduleId: { in: moduleIds },
      program: { audience: CourseAudience.SCHOOL },
      published: true,
      verificationStatus: AssessmentVerificationStatus.APPROVED,
    },
    select: { id: true, type: true, totalPoints: true, moduleId: true },
  });
  const assessmentById = new Map(assessments.map((a) => [a.id, a]));

  const subs = assessments.length
    ? await prisma.assessmentSubmission.findMany({
        where: { studentId: { in: userIds }, assessmentId: { in: assessments.map((a) => a.id) }, status: AttemptStatus.GRADED },
        select: { studentId: true, assessmentId: true, totalScore: true },
      })
    : [];

  // key = `${userId}:${moduleId}` -> CA + EXAM buckets
  const buckets = new Map<string, { ca: Bucket; exam: Bucket }>();
  for (const s of subs) {
    const a = assessmentById.get(s.assessmentId);
    if (!a || !a.moduleId) continue;
    const key = `${s.studentId}:${a.moduleId}`;
    let bk = buckets.get(key);
    if (!bk) {
      bk = { ca: { earned: 0, total: 0 }, exam: { earned: 0, total: 0 } };
      buckets.set(key, bk);
    }
    const b = isExam(a.type) ? bk.exam : bk.ca;
    b.earned += s.totalScore;
    b.total += a.totalPoints;
  }

  return {
    modules: moduleOut,
    pupils: enrollments.map((e) => ({
      userId: e.userId,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      results: Object.fromEntries(
        modules.map((m) => {
          const bk = buckets.get(`${e.userId}:${m.id}`) ?? { ca: { earned: 0, total: 0 }, exam: { earned: 0, total: 0 } };
          return [m.id, termResultFrom(bk.ca, bk.exam)];
        }),
      ),
    })),
  };
}

/**
 * REPORT-ONLY assessment gate. When a pupil's term result reaches the pass mark, record it on
 * ModuleGateStatus.assessmentGate so the teacher report can show mastery. It never blocks advancement
 * (access stays a licence decision); it is a signal, not a lock. Never throws, a gate must not break the
 * grading request that triggered it.
 */
export async function trySchoolAssessmentGate(userId: string, moduleId: string): Promise<void> {
  try {
    const result = await computeTermResult(userId, moduleId);
    if (!result.passed) return;

    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { version: { select: { curriculum: { select: { programId: true } } } } },
    });
    const programId = moduleRecord?.version?.curriculum?.programId;
    if (!programId) return;

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, programId },
      select: { id: true },
    });
    if (!enrollment) return;

    await prisma.moduleGateStatus.upsert({
      where: { userId_moduleId: { userId, moduleId } },
      create: {
        userId,
        moduleId,
        enrollmentId: enrollment.id,
        assessmentGate: GateStatus.PASSED,
        assessmentPassedAt: new Date(),
      },
      update: { assessmentGate: GateStatus.PASSED, assessmentPassedAt: new Date() },
    });
  } catch {
    /* a gate is a signal, never crash the grading request over it */
  }
}

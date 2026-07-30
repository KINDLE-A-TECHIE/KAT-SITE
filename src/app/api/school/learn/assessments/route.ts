import {
  AssessmentVerificationStatus,
  AttemptStatus,
  CourseAudience,
  EnrollmentStatus,
  QuestionType,
} from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSchoolStudent } from "@/lib/school";
import { checkModuleLicenseForEnrollment, getLicensedTermNumbers } from "@/lib/school-license";
import { termNumberForModule } from "@/lib/school-term";
import { scoreCodeAnswer, type CodeTestRun } from "@/lib/practical-grading";
import { trySchoolAssessmentGate } from "@/lib/school-grading";
import { schoolSubmitAssessmentSchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * A school pupil's tests and exams: list the ones open to them now, fetch one to take, and submit it.
 *
 * This is the SCHOOL path, deliberately separate from /api/assessments/submissions (which the security
 * test locks to audience B2C). Everything is scoped to the pupil's own enrollment + class, the
 * assessment must be scheduled to their class and inside its window, and the module's term must be
 * licensed.
 *
 * INTEGRITY: the take payload never carries a correct answer, a hidden test's expected output, or a
 * rubric's mark scheme. For a CODE question the client runs the pupil's code and reports the OUTPUT it
 * produced per test; the server compares that to the hidden expected output here, so the answer key
 * never reaches the browser.
 */

function withinWindow(opensAt: Date | null, closesAt: Date | null, now: Date): boolean {
  return (!opensAt || opensAt <= now) && (!closesAt || closesAt >= now);
}

// Resolve and fully authorize a take/submit for one assessment, or return an error to send back.
async function resolveContext(userId: string, schoolId: string, assessmentId: string) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      published: true,
      verificationStatus: AssessmentVerificationStatus.APPROVED,
      program: { audience: CourseAudience.SCHOOL },
    },
    select: {
      id: true,
      title: true,
      type: true,
      totalPoints: true,
      programId: true,
      moduleId: true,
      module: { select: { sortOrder: true } },
      questions: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          prompt: true,
          type: true,
          points: true,
          codeLanguage: true,
          starterCode: true,
          options: { select: { id: true, label: true, value: true, isCorrect: true } },
          testCases: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, stdin: true, expectedStdout: true, points: true, hidden: true },
          },
          rubricCriteria: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, label: true, description: true, maxPoints: true },
          },
        },
      },
    },
  });
  const deny = (error: string, status: 403 | 404) => ({ ok: false as const, error, status });
  if (!assessment || !assessment.module) return deny("Assessment not available.", 404);

  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, schoolId, programId: assessment.programId, status: EnrollmentStatus.ACTIVE },
    select: { id: true, schoolId: true, schoolClassId: true },
  });
  if (!enrollment || !enrollment.schoolClassId) return deny("You are not enrolled in this course.", 403);

  const sched = await prisma.schoolClassAssessment.findUnique({
    where: { schoolClassId_assessmentId: { schoolClassId: enrollment.schoolClassId, assessmentId } },
    select: { opensAt: true, closesAt: true },
  });
  if (!sched) return deny("This assessment has not been set for your class yet.", 403);
  if (sched.opensAt && sched.opensAt > new Date()) return deny("This assessment has not opened yet.", 403);
  if (sched.closesAt && sched.closesAt < new Date()) return deny("This assessment has closed.", 403);

  const gate = await checkModuleLicenseForEnrollment(enrollment, assessment.module.sortOrder);
  if (!gate.allowed) return deny(gate.reason ?? "This assessment's term is not licensed.", 403);

  return { ok: true as const, assessment, enrollment };
}

export async function GET(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await ensureSchoolStudent());
  } catch {
    return fail("Forbidden", 403);
  }
  const session = await getServerAuthSession();
  const userId = session!.user.id;
  const assessmentId = new URL(request.url).searchParams.get("assessmentId");

  try {
    // ── One assessment to take: strip every answer key before sending. ──
    if (assessmentId) {
      const ctx = await resolveContext(userId, schoolId, assessmentId);
      if (!ctx.ok) return fail(ctx.error, ctx.status);

      const already = await prisma.assessmentSubmission.findFirst({
        where: { assessmentId, studentId: userId },
        select: { id: true },
      });
      if (already) return fail("You have already submitted this assessment.", 409);

      const questions = ctx.assessment.questions.map((q) => {
        const base = { id: q.id, prompt: q.prompt, type: q.type, points: q.points };
        if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
          return { ...base, options: q.options.map((o) => ({ id: o.id, label: o.label, value: o.value })) };
        }
        if (q.type === QuestionType.CODE) {
          return {
            ...base,
            codeLanguage: q.codeLanguage ?? "python",
            starterCode: q.starterCode ?? "",
            // stdin is needed to run; expected output is sent ONLY for visible sample cases.
            testCases: q.testCases.map((tc) => ({
              id: tc.id,
              stdin: tc.stdin,
              hidden: tc.hidden,
              expectedStdout: tc.hidden ? null : tc.expectedStdout,
            })),
          };
        }
        if (q.type === QuestionType.RUBRIC) {
          return { ...base, rubric: q.rubricCriteria.map((c) => ({ label: c.label, description: c.description, maxPoints: c.maxPoints })) };
        }
        return base; // OPEN_ENDED
      });

      return ok({ id: ctx.assessment.id, title: ctx.assessment.title, type: ctx.assessment.type, questions });
    }

    // ── List the pupil's open, licensed, unsubmitted assessments. ──
    const enrollments = await prisma.enrollment.findMany({
      where: { userId, schoolId, status: EnrollmentStatus.ACTIVE, schoolClassId: { not: null } },
      select: { schoolClassId: true, schoolClass: { select: { sessionLabel: true } } },
    });
    const classIds = enrollments.map((e) => e.schoolClassId).filter((id): id is string => Boolean(id));
    if (classIds.length === 0) return ok({ assessments: [] });

    const now = new Date();
    const scheduled = await prisma.schoolClassAssessment.findMany({
      where: {
        schoolClassId: { in: classIds },
        assessment: { published: true, verificationStatus: AssessmentVerificationStatus.APPROVED, program: { audience: CourseAudience.SCHOOL } },
      },
      select: {
        opensAt: true,
        closesAt: true,
        schoolClass: { select: { sessionLabel: true } },
        assessment: { select: { id: true, title: true, type: true, totalPoints: true, module: { select: { title: true, sortOrder: true } } } },
      },
    });

    const submitted = new Set(
      (await prisma.assessmentSubmission.findMany({
        where: { studentId: userId, assessmentId: { in: scheduled.map((s) => s.assessment.id) } },
        select: { assessmentId: true },
      })).map((s) => s.assessmentId),
    );

    // Licensed terms are per session; cache so we do not re-query per row.
    const licenseCache = new Map<string, Set<number>>();
    const items = [];
    for (const s of scheduled) {
      if (!s.assessment.module) continue;
      const session = s.schoolClass.sessionLabel;
      if (!licenseCache.has(session)) licenseCache.set(session, await getLicensedTermNumbers(schoolId, session));
      const licensed = licenseCache.get(session)!.has(termNumberForModule(s.assessment.module.sortOrder));
      if (!licensed || !withinWindow(s.opensAt, s.closesAt, now)) continue;
      items.push({
        id: s.assessment.id,
        title: s.assessment.title,
        type: s.assessment.type,
        totalPoints: s.assessment.totalPoints,
        moduleTitle: s.assessment.module.title,
        opensAt: s.opensAt,
        closesAt: s.closesAt,
        submitted: submitted.has(s.assessment.id),
      });
    }

    return ok({ assessments: items });
  } catch (error) {
    captureError(error);
    return fail("Could not load assessments.", 500);
  }
}

export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await ensureSchoolStudent());
  } catch {
    return fail("Forbidden", 403);
  }
  const session = await getServerAuthSession();
  const userId = session!.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }
  const parsed = schoolSubmitAssessmentSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  try {
    const ctx = await resolveContext(userId, schoolId, parsed.data.assessmentId);
    if (!ctx.ok) return fail(ctx.error, ctx.status);
    const { assessment, enrollment } = ctx;

    // One attempt: a re-submit is refused (matches the B2C single-attempt rule).
    const existing = await prisma.assessmentSubmission.findFirst({
      where: { assessmentId: assessment.id, studentId: userId },
      select: { id: true },
    });
    if (existing) return fail("You have already submitted this assessment.", 409);

    const answersMap = new Map(parsed.data.answers.map((a) => [a.questionId, a]));
    let autoScore = 0;
    let hasManual = false;
    const answerRows: {
      questionId: string;
      selectedOptionId?: string | null;
      responseText?: string | null;
      isCorrect: boolean | null;
      autoScore: number;
    }[] = [];

    for (const q of assessment.questions) {
      const incoming = answersMap.get(q.id);

      if (q.type === QuestionType.MULTIPLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
        const option = q.options.find((o) => o.id === incoming?.selectedOptionId);
        const isCorrect = Boolean(option?.isCorrect);
        const score = isCorrect ? q.points : 0;
        autoScore += score;
        answerRows.push({ questionId: q.id, selectedOptionId: incoming?.selectedOptionId ?? null, isCorrect, autoScore: score });
      } else if (q.type === QuestionType.CODE) {
        // Compare the pupil-reported output for each test case to the HIDDEN expected output (server-side).
        const byTc = new Map((incoming?.codeRuns ?? []).map((r) => [r.testCaseId, r]));
        const runs: CodeTestRun[] = q.testCases.map((tc) => {
          const r = byTc.get(tc.id);
          return {
            testCase: { id: tc.id, expectedStdout: tc.expectedStdout, points: tc.points },
            actualStdout: r?.stdout ?? "",
            // A missing run for this case fails it; a present run is not errored unless it says so.
            errored: r ? Boolean(r.errored) : true,
          };
        });
        const scored = scoreCodeAnswer(runs);
        autoScore += scored.earned;
        answerRows.push({
          questionId: q.id,
          responseText: incoming?.responseText ?? null, // the pupil's code, stored for teacher re-run
          isCorrect: scored.total > 0 ? scored.earned === scored.total : null,
          autoScore: scored.earned,
        });
      } else {
        // OPEN_ENDED (theory) and RUBRIC (observed) are graded by the teacher later.
        hasManual = true;
        answerRows.push({ questionId: q.id, responseText: incoming?.responseText ?? null, isCorrect: null, autoScore: 0 });
      }
    }

    const status = hasManual ? AttemptStatus.IN_REVIEW : AttemptStatus.GRADED;
    const submission = await prisma.assessmentSubmission.create({
      data: {
        assessmentId: assessment.id,
        studentId: userId,
        enrollmentId: enrollment.id,
        status,
        autoScore,
        totalScore: autoScore,
        gradedAt: status === AttemptStatus.GRADED ? new Date() : null,
        answers: { createMany: { data: answerRows } },
      },
      select: { id: true, status: true, autoScore: true, totalScore: true },
    });

    // A fully auto-marked submission can complete the term; update the report-only assessment gate.
    if (status === AttemptStatus.GRADED && assessment.moduleId) {
      await trySchoolAssessmentGate(userId, assessment.moduleId);
    }

    return ok(
      { submissionId: submission.id, status: submission.status, autoScore: submission.autoScore, totalScore: submission.totalScore },
      201,
    );
  } catch (error) {
    captureError(error);
    return fail("Could not submit the assessment.", 500);
  }
}

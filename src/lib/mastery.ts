import { AttemptStatus, GateStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Upserts a ModuleGateStatus row for the given (userId, moduleId) pair.
 * Returns the existing or freshly-created record.
 */
async function ensureGateRecord(userId: string, moduleId: string, enrollmentId: string) {
  return prisma.moduleGateStatus.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    create: { userId, moduleId, enrollmentId },
    update: {},
  });
}

/**
 * If all three gates are PASSED, seals the record by setting
 * allGatesPassed = true and allGatesPassedAt = now().
 * Safe to call multiple times, idempotent.
 */
async function checkAndSealGates(userId: string, moduleId: string) {
  const record = await prisma.moduleGateStatus.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: {
      id: true,
      assessmentGate: true,
      projectGate: true,
      instructorGate: true,
      allGatesPassed: true,
    },
  });

  if (!record || record.allGatesPassed) return;

  if (
    record.assessmentGate === GateStatus.PASSED &&
    record.projectGate === GateStatus.PASSED &&
    record.instructorGate === GateStatus.PASSED
  ) {
    await prisma.moduleGateStatus.update({
      where: { id: record.id },
      data: { allGatesPassed: true, allGatesPassedAt: new Date() },
    });
  }
}

/**
 * Recomputes allGatesPassed from the three gate columns and returns the resulting value.
 *
 * Unlike checkAndSealGates (seal-only, used by the B2C flow where a passed gate is never
 * revoked) this also UN-seals: a school gate can be withdrawn, a project approval reversed
 * or a sign-off retracted, and combined mastery must drop back to false rather than leave a
 * stale pass on the report card. Idempotent; no-ops when nothing changes.
 */
export async function recomputeModuleMastery(userId: string, moduleId: string): Promise<boolean> {
  const record = await prisma.moduleGateStatus.findUnique({
    where: { userId_moduleId: { userId, moduleId } },
    select: {
      id: true,
      assessmentGate: true,
      projectGate: true,
      instructorGate: true,
      allGatesPassed: true,
    },
  });
  if (!record) return false;

  const allPassed =
    record.assessmentGate === GateStatus.PASSED &&
    record.projectGate === GateStatus.PASSED &&
    record.instructorGate === GateStatus.PASSED;

  if (allPassed === record.allGatesPassed) return allPassed;

  await prisma.moduleGateStatus.update({
    where: { id: record.id },
    data: { allGatesPassed: allPassed, allGatesPassedAt: allPassed ? new Date() : null },
  });
  return allPassed;
}

/**
 * A school TEACHER signs off (passed = true) or retracts (false) the instructor gate for one
 * pupil on one module. Report-only, like the other school gates: it records the teacher's
 * judgement and recomputes combined mastery, it never blocks advancement and sends no
 * notification (the B2C bell is not used in the school product). Never throws; returns the
 * resulting combined mastery, or null if the module/enrolment cannot be resolved.
 *
 * AUTHORISATION is the caller's job: the route verifies the teacher owns the class and the
 * pupil is enrolled in it before calling this.
 */
export async function setSchoolInstructorGate(
  signerId: string,
  studentId: string,
  moduleId: string,
  passed: boolean,
): Promise<{ allGatesPassed: boolean } | null> {
  try {
    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { version: { select: { curriculum: { select: { programId: true } } } } },
    });
    const programId = moduleRecord?.version?.curriculum?.programId;
    if (!programId) return null;

    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: studentId, programId },
      select: { id: true },
    });
    if (!enrollment) return null;

    const instructorGate = passed ? GateStatus.PASSED : GateStatus.NOT_STARTED;
    const instructorPassedAt = passed ? new Date() : null;
    const signedOffById = passed ? signerId : null;

    await prisma.moduleGateStatus.upsert({
      where: { userId_moduleId: { userId: studentId, moduleId } },
      create: { userId: studentId, moduleId, enrollmentId: enrollment.id, instructorGate, instructorPassedAt, signedOffById },
      update: { instructorGate, instructorPassedAt, signedOffById },
    });

    const allGatesPassed = await recomputeModuleMastery(studentId, moduleId);
    return { allGatesPassed };
  } catch {
    return null;
  }
}

/**
 * Called after an assessment submission is graded.
 * Checks if the student passed and the assessment belongs to a module.
 * If so, marks Gate 1 (Knowledge Assessment) as PASSED for that module.
 */
export async function tryCompleteAssessmentGate(
  studentId: string,
  submissionId: string,
): Promise<void> {
  try {
    const submission = await prisma.assessmentSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        totalScore: true,
        status: true,
        enrollmentId: true,
        assessment: {
          select: {
            moduleId: true,
            passScore: true,
          },
        },
      },
    });

    if (!submission) return;
    if (submission.status !== AttemptStatus.GRADED) return;
    if (!submission.assessment.moduleId) return;
    if (!submission.enrollmentId) return;

    const passed = submission.totalScore >= submission.assessment.passScore;
    if (!passed) return;

    const { moduleId } = submission.assessment;
    const { enrollmentId } = submission;

    await ensureGateRecord(studentId, moduleId, enrollmentId);

    // Only update if not already passed (preserve the earliest passingSubmissionId)
    const existing = await prisma.moduleGateStatus.findUnique({
      where: { userId_moduleId: { userId: studentId, moduleId } },
      select: { assessmentGate: true },
    });
    if (existing?.assessmentGate === GateStatus.PASSED) return;

    await prisma.moduleGateStatus.update({
      where: { userId_moduleId: { userId: studentId, moduleId } },
      data: {
        assessmentGate: GateStatus.PASSED,
        assessmentPassedAt: new Date(),
        passingSubmissionId: submissionId,
      },
    });

    await checkAndSealGates(studentId, moduleId);
  } catch {
    // Gate completion must never crash the parent request
  }
}

/**
 * Called after a project's status is set to APPROVED.
 * Resolves the module via the project's linked assessment.
 * If found, marks Gate 2 (Capstone Project) as PASSED for that module.
 */
export async function tryCompleteProjectGate(
  studentId: string,
  projectId: string,
): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        programId: true,
        assessmentId: true,
        assessment: {
          select: { moduleId: true },
        },
      },
    });

    if (!project?.assessment?.moduleId) return;
    if (!project.programId) return;

    const moduleId = project.assessment.moduleId;

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_programId: { userId: studentId, programId: project.programId } },
      select: { id: true },
    });
    if (!enrollment) return;

    await ensureGateRecord(studentId, moduleId, enrollment.id);

    const existing = await prisma.moduleGateStatus.findUnique({
      where: { userId_moduleId: { userId: studentId, moduleId } },
      select: { projectGate: true },
    });
    if (existing?.projectGate === GateStatus.PASSED) return;

    await prisma.moduleGateStatus.update({
      where: { userId_moduleId: { userId: studentId, moduleId } },
      data: {
        projectGate: GateStatus.PASSED,
        projectPassedAt: new Date(),
        passingProjectId: projectId,
      },
    });

    await checkAndSealGates(studentId, moduleId);
  } catch {
    // Gate completion must never crash the parent request
  }
}

/**
 * Called when an instructor explicitly signs off on a student's module evaluation.
 * Marks Gate 3 (Instructor Evaluation) as PASSED.
 * Returns the updated record, or null if the module/enrollment cannot be resolved.
 */
export async function tryCompleteInstructorGate(
  instructorId: string,
  studentId: string,
  moduleId: string,
): Promise<{ allGatesPassed: boolean } | null> {
  try {
    // Resolve the module → version → curriculum → program to find the enrollment
    const moduleRecord = await prisma.module.findUnique({
      where: { id: moduleId },
      select: {
        version: {
          select: {
            curriculum: {
              select: { programId: true },
            },
          },
        },
      },
    });

    const programId = moduleRecord?.version?.curriculum?.programId;
    if (!programId) return null;

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_programId: { userId: studentId, programId } },
      select: { id: true },
    });
    if (!enrollment) return null;

    await ensureGateRecord(studentId, moduleId, enrollment.id);

    await prisma.moduleGateStatus.update({
      where: { userId_moduleId: { userId: studentId, moduleId } },
      data: {
        instructorGate: GateStatus.PASSED,
        instructorPassedAt: new Date(),
        signedOffById: instructorId,
      },
    });

    await checkAndSealGates(studentId, moduleId);

    const record = await prisma.moduleGateStatus.findUnique({
      where: { userId_moduleId: { userId: studentId, moduleId } },
      select: { allGatesPassed: true },
    });

    return record ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns a map of moduleId → gate status for the given user.
 * Used by the progress API and curriculum tree to determine module lock state.
 */
export async function getModuleGatesForUser(
  userId: string,
  moduleIds: string[],
): Promise<
  Record<
    string,
    {
      assessmentGate: GateStatus;
      projectGate: GateStatus;
      instructorGate: GateStatus;
      allGatesPassed: boolean;
    }
  >
> {
  if (moduleIds.length === 0) return {};

  const records = await prisma.moduleGateStatus.findMany({
    where: { userId, moduleId: { in: moduleIds } },
    select: {
      moduleId: true,
      assessmentGate: true,
      projectGate: true,
      instructorGate: true,
      allGatesPassed: true,
    },
  });

  return Object.fromEntries(records.map((r) => [r.moduleId, r]));
}

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
 * Safe to call multiple times — idempotent.
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

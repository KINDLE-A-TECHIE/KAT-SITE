import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma enum stubs ──────────────────────────────────────────────────────────
vi.mock("@prisma/client", () => ({
  GateStatus: { PENDING: "PENDING", PASSED: "PASSED", FAILED: "FAILED" },
  AttemptStatus: { GRADED: "GRADED", IN_REVIEW: "IN_REVIEW", PENDING: "PENDING" },
}));

// vi.mock is hoisted before variable declarations, so mockPrisma must be
// defined with vi.hoisted() to be accessible inside the factory function.
const mockPrisma = vi.hoisted(() => ({
  moduleGateStatus: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  assessmentSubmission: {
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
  },
  enrollment: {
    findUnique: vi.fn(),
  },
  module: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  tryCompleteAssessmentGate,
  tryCompleteProjectGate,
  tryCompleteInstructorGate,
  getModuleGatesForUser,
} from "@/lib/mastery";

const IDS = {
  student: "student-1",
  module: "module-1",
  enrollment: "enrollment-1",
  submission: "submission-1",
  project: "project-1",
  program: "program-1",
  instructor: "instructor-1",
};

// A fully-graded submission that passes the gate
function passingSubmission(overrides = {}) {
  return {
    id: IDS.submission,
    totalScore: 80,
    status: "GRADED",
    enrollmentId: IDS.enrollment,
    assessment: { moduleId: IDS.module, passScore: 70 }, ...overrides,
  };
}

function gateRecord(overrides = {}) {
  return {
    id: "gate-record-1",
    assessmentGate: "PENDING",
    projectGate: "PENDING",
    instructorGate: "PENDING",
    allGatesPassed: false, ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  // Default: upsert succeeds and update succeeds
  mockPrisma.moduleGateStatus.upsert.mockResolvedValue(gateRecord());
  mockPrisma.moduleGateStatus.update.mockResolvedValue({});
});

// ── tryCompleteAssessmentGate ──────────────────────────────────────────────────

describe("tryCompleteAssessmentGate", () => {
  it("does nothing when the submission does not exist", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue(null);
    await tryCompleteAssessmentGate(IDS.student, IDS.submission);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("does nothing when the submission is not yet GRADED", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue(
      passingSubmission({ status: "IN_REVIEW" }),
    );
    await tryCompleteAssessmentGate(IDS.student, IDS.submission);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("does nothing when the assessment has no moduleId", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue(
      passingSubmission({ assessment: { moduleId: null, passScore: 70 } }),
    );
    await tryCompleteAssessmentGate(IDS.student, IDS.submission);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("does nothing when the submission has no enrollmentId", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue(
      passingSubmission({ enrollmentId: null }),
    );
    await tryCompleteAssessmentGate(IDS.student, IDS.submission);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("does nothing when the student's score is below the pass score", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue(
      passingSubmission({ totalScore: 50, assessment: { moduleId: IDS.module, passScore: 70 } }),
    );
    await tryCompleteAssessmentGate(IDS.student, IDS.submission);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("marks the assessment gate PASSED when the student passes", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue(passingSubmission());
    // No existing gate record → PENDING
    mockPrisma.moduleGateStatus.findUnique.mockResolvedValue(
      gateRecord({ assessmentGate: "PENDING" }),
    );

    await tryCompleteAssessmentGate(IDS.student, IDS.submission);

    expect(mockPrisma.moduleGateStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assessmentGate: "PASSED" }),
      }),
    );
  });

  it("is idempotent, does not update if gate is already PASSED", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockResolvedValue(passingSubmission());
    // Gate already passed
    mockPrisma.moduleGateStatus.findUnique.mockResolvedValue(
      gateRecord({ assessmentGate: "PASSED" }),
    );

    await tryCompleteAssessmentGate(IDS.student, IDS.submission);

    // upsert is called to ensure record exists, but update should NOT be called
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("never throws even when Prisma rejects", async () => {
    mockPrisma.assessmentSubmission.findUnique.mockRejectedValue(new Error("DB down"));
    await expect(tryCompleteAssessmentGate(IDS.student, IDS.submission)).resolves.toBeUndefined();
  });
});

// ── tryCompleteProjectGate ─────────────────────────────────────────────────────

describe("tryCompleteProjectGate", () => {
  const fullProject = {
    id: IDS.project,
    programId: IDS.program,
    assessmentId: "assessment-1",
    assessment: { moduleId: IDS.module },
  };

  it("does nothing when the project does not exist", async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    await tryCompleteProjectGate(IDS.student, IDS.project);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("does nothing when the project has no linked assessment", async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      ...fullProject,
      assessment: null,
    });
    await tryCompleteProjectGate(IDS.student, IDS.project);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("does nothing when there is no enrollment for the student", async () => {
    mockPrisma.project.findUnique.mockResolvedValue(fullProject);
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    await tryCompleteProjectGate(IDS.student, IDS.project);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("marks the project gate PASSED when all prerequisites are met", async () => {
    mockPrisma.project.findUnique.mockResolvedValue(fullProject);
    mockPrisma.enrollment.findUnique.mockResolvedValue({ id: IDS.enrollment });
    mockPrisma.moduleGateStatus.findUnique.mockResolvedValue(
      gateRecord({ projectGate: "PENDING" }),
    );

    await tryCompleteProjectGate(IDS.student, IDS.project);

    expect(mockPrisma.moduleGateStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectGate: "PASSED" }),
      }),
    );
  });

  it("is idempotent, skips update if project gate already PASSED", async () => {
    mockPrisma.project.findUnique.mockResolvedValue(fullProject);
    mockPrisma.enrollment.findUnique.mockResolvedValue({ id: IDS.enrollment });
    mockPrisma.moduleGateStatus.findUnique.mockResolvedValue(
      gateRecord({ projectGate: "PASSED" }),
    );

    await tryCompleteProjectGate(IDS.student, IDS.project);
    expect(mockPrisma.moduleGateStatus.update).not.toHaveBeenCalled();
  });

  it("never throws even when Prisma rejects", async () => {
    mockPrisma.project.findUnique.mockRejectedValue(new Error("DB down"));
    await expect(tryCompleteProjectGate(IDS.student, IDS.project)).resolves.toBeUndefined();
  });
});

// ── tryCompleteInstructorGate ──────────────────────────────────────────────────

describe("tryCompleteInstructorGate", () => {
  const moduleRecord = {
    version: { curriculum: { programId: IDS.program } },
  };

  it("returns null when the module cannot be found", async () => {
    mockPrisma.module.findUnique.mockResolvedValue(null);
    const result = await tryCompleteInstructorGate(IDS.instructor, IDS.student, IDS.module);
    expect(result).toBeNull();
  });

  it("returns null when there is no enrollment for the student", async () => {
    mockPrisma.module.findUnique.mockResolvedValue(moduleRecord);
    mockPrisma.enrollment.findUnique.mockResolvedValue(null);
    const result = await tryCompleteInstructorGate(IDS.instructor, IDS.student, IDS.module);
    expect(result).toBeNull();
  });

  it("marks the instructor gate PASSED and returns the gate status", async () => {
    mockPrisma.module.findUnique.mockResolvedValue(moduleRecord);
    mockPrisma.enrollment.findUnique.mockResolvedValue({ id: IDS.enrollment });
    // ensureGateRecord uses upsert; first findUnique is from checkAndSealGates,
    // second is the final read at the end of tryCompleteInstructorGate.
    mockPrisma.moduleGateStatus.findUnique
      .mockResolvedValueOnce(gateRecord()) // checkAndSealGates, not all passed yet
      .mockResolvedValueOnce({ allGatesPassed: false }); // final read

    const result = await tryCompleteInstructorGate(IDS.instructor, IDS.student, IDS.module);

    expect(mockPrisma.moduleGateStatus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instructorGate: "PASSED",
          signedOffById: IDS.instructor,
        }),
      }),
    );
    expect(result).toEqual({ allGatesPassed: false });
  });

  it("reports allGatesPassed: true when all three gates are sealed", async () => {
    mockPrisma.module.findUnique.mockResolvedValue(moduleRecord);
    mockPrisma.enrollment.findUnique.mockResolvedValue({ id: IDS.enrollment });
    // ensureGateRecord uses upsert (not findUnique), so the first findUnique
    // call is from checkAndSealGates, and the second is the final read.
    mockPrisma.moduleGateStatus.findUnique
      .mockResolvedValueOnce(
        gateRecord({
          assessmentGate: "PASSED",
          projectGate: "PASSED",
          instructorGate: "PASSED",
          allGatesPassed: false,
        }),
      ) // checkAndSealGates → all 3 passed → triggers seal update
      .mockResolvedValueOnce({ allGatesPassed: true }); // final read

    const result = await tryCompleteInstructorGate(IDS.instructor, IDS.student, IDS.module);
    expect(result).toEqual({ allGatesPassed: true });
  });

  it("returns null when an error occurs (never throws)", async () => {
    mockPrisma.module.findUnique.mockRejectedValue(new Error("DB timeout"));
    const result = await tryCompleteInstructorGate(IDS.instructor, IDS.student, IDS.module);
    expect(result).toBeNull();
  });
});

// ── getModuleGatesForUser ──────────────────────────────────────────────────────

describe("getModuleGatesForUser", () => {
  it("returns an empty object when moduleIds is empty", async () => {
    const result = await getModuleGatesForUser(IDS.student, []);
    expect(result).toEqual({});
    expect(mockPrisma.moduleGateStatus.findMany).not.toHaveBeenCalled();
  });

  it("maps moduleId to gate status for each record returned", async () => {
    const records = [
      {
        moduleId: "mod-a",
        assessmentGate: "PASSED",
        projectGate: "PENDING",
        instructorGate: "PENDING",
        allGatesPassed: false,
      },
      {
        moduleId: "mod-b",
        assessmentGate: "PASSED",
        projectGate: "PASSED",
        instructorGate: "PASSED",
        allGatesPassed: true,
      },
    ];

    mockPrisma.moduleGateStatus.findMany.mockResolvedValue(records);

    const result = await getModuleGatesForUser(IDS.student, ["mod-a", "mod-b"]);

    expect(result["mod-a"].allGatesPassed).toBe(false);
    expect(result["mod-b"].allGatesPassed).toBe(true);
    expect(result["mod-b"].instructorGate).toBe("PASSED");
  });

  it("returns an empty object when no records are found for the given moduleIds", async () => {
    mockPrisma.moduleGateStatus.findMany.mockResolvedValue([]);
    const result = await getModuleGatesForUser(IDS.student, ["mod-x", "mod-y"]);
    expect(result).toEqual({});
  });

  it("passes the correct userId and moduleId filter to Prisma", async () => {
    mockPrisma.moduleGateStatus.findMany.mockResolvedValue([]);
    await getModuleGatesForUser("u-42", ["m-1", "m-2"]);
    expect(mockPrisma.moduleGateStatus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-42", moduleId: { in: ["m-1", "m-2"] } },
      }),
    );
  });
});

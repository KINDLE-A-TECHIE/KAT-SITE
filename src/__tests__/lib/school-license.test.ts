import { describe, it, expect, vi, beforeEach } from "vitest";
import { SchoolLicenseStatus } from "@prisma/client";

/**
 * checkClassLicense is THE gate: every learner and teacher surface asks it whether a class is
 * accessible. In A2 it became session-level (a class is a cohort for a session) and gained the
 * 15-week window. These pin the outcomes that decide whether a paying school's pupils get in.
 */

const mockPrisma = vi.hoisted(() => ({
  schoolLicense: { findMany: vi.fn() },
  schoolClass: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  checkClassLicense,
  getLicensedTermNumbers,
  checkModuleLicenseForEnrollment,
  checkLessonPreviewLicense,
} from "@/lib/school-license";

type LicRow = {
  id: string;
  sessionLabel: string;
  termNumber: number;
  status: SchoolLicenseStatus;
  startsAt: Date | null;
  seatLimit: number;
  seatsUsed: number;
};

const lic = (over: Partial<LicRow>): LicRow => ({
  id: "lic_1",
  sessionLabel: "2025/2026",
  termNumber: 1,
  status: SchoolLicenseStatus.ACTIVE,
  startsAt: null, // null window = no time limit
  seatLimit: 50,
  seatsUsed: 10,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("checkClassLicense", () => {
  it("allows a B2C enrollment (null schoolId) without querying", async () => {
    const gate = await checkClassLicense(null, null);
    expect(gate.allowed).toBe(true);
    expect(mockPrisma.schoolLicense.findMany).not.toHaveBeenCalled();
  });

  it("fails closed when a school enrollment has no class/session", async () => {
    const gate = await checkClassLicense("sch_1", null);
    expect(gate).toMatchObject({ allowed: false, code: "NO_CLASS" });
  });

  it("returns NO_LICENSE when the school has no licence for the session", async () => {
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ sessionLabel: "2024/2025" })]);
    const gate = await checkClassLicense("sch_1", "2025/2026");
    expect(gate).toMatchObject({ allowed: false, code: "NO_LICENSE" });
  });

  it("returns INACTIVE when the session's licence is not ACTIVE", async () => {
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ status: SchoolLicenseStatus.PENDING })]);
    const gate = await checkClassLicense("sch_1", "2025/2026");
    expect(gate).toMatchObject({ allowed: false, code: "INACTIVE" });
  });

  it("returns EXPIRED_WINDOW when the term's 15-week window has passed", async () => {
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000); // >15 weeks ago
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ startsAt: longAgo })]);
    const gate = await checkClassLicense("sch_1", "2025/2026");
    expect(gate).toMatchObject({ allowed: false, code: "EXPIRED_WINDOW" });
  });

  it("returns OVER_SEATED when usage exceeds the limit", async () => {
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ seatsUsed: 51, seatLimit: 50 })]);
    const gate = await checkClassLicense("sch_1", "2025/2026");
    expect(gate).toMatchObject({ allowed: false, code: "OVER_SEATED" });
  });

  it("allows an ACTIVE, in-window, seated licence and matches the session forgivingly", async () => {
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({})]);
    const gate = await checkClassLicense("sch_1", "  2025/2026 ");
    expect(gate.allowed).toBe(true);
    if (gate.allowed) expect(gate.license.sessionLabel).toBe("2025/2026");
  });

  it("resolves the current term as the highest-numbered usable licence", async () => {
    mockPrisma.schoolLicense.findMany.mockResolvedValue([
      lic({ id: "t1", termNumber: 1 }),
      lic({ id: "t2", termNumber: 2 }),
    ]);
    const gate = await checkClassLicense("sch_1", "2025/2026");
    expect(gate.allowed).toBe(true);
    if (gate.allowed) expect(gate.license.termNumber).toBe(2);
  });
});

describe("getLicensedTermNumbers", () => {
  it("returns only the ACTIVE, in-window terms of the session", async () => {
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    mockPrisma.schoolLicense.findMany.mockResolvedValue([
      lic({ termNumber: 1 }), // active, null window
      lic({ termNumber: 2, status: SchoolLicenseStatus.PENDING }), // not active
      lic({ termNumber: 3, startsAt: longAgo }), // expired window
      lic({ termNumber: 1, sessionLabel: "2024/2025" }), // other session
    ]);
    const terms = await getLicensedTermNumbers("sch_1", "2025/2026");
    expect([...terms].sort()).toEqual([1]);
  });
});

describe("checkModuleLicenseForEnrollment", () => {
  it("allows any B2C enrollment (null schoolId) without querying", async () => {
    const gate = await checkModuleLicenseForEnrollment({ schoolId: null, schoolClassId: null }, 5);
    expect(gate.allowed).toBe(true);
    expect(mockPrisma.schoolClass.findUnique).not.toHaveBeenCalled();
  });

  it("allows a module whose term (sortOrder+1) is licensed", async () => {
    mockPrisma.schoolClass.findUnique.mockResolvedValue({ sessionLabel: "2025/2026" });
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ termNumber: 1 })]);
    // sortOrder 0 -> term 1, which is licensed
    const gate = await checkModuleLicenseForEnrollment({ schoolId: "sch_1", schoolClassId: "cls_1" }, 0);
    expect(gate.allowed).toBe(true);
  });

  it("denies a module whose term is not licensed", async () => {
    mockPrisma.schoolClass.findUnique.mockResolvedValue({ sessionLabel: "2025/2026" });
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ termNumber: 1 })]);
    // sortOrder 1 -> term 2, which is NOT licensed (only term 1 is)
    const gate = await checkModuleLicenseForEnrollment({ schoolId: "sch_1", schoolClassId: "cls_1" }, 1);
    expect(gate.allowed).toBe(false);
  });

  it("denies when the enrollment has no class", async () => {
    const gate = await checkModuleLicenseForEnrollment({ schoolId: "sch_1", schoolClassId: null }, 0);
    expect(gate.allowed).toBe(false);
  });
});

describe("checkLessonPreviewLicense (staff)", () => {
  it("allows a SAMPLE lesson even on an unlicensed term, without querying", async () => {
    // Term 2 (sortOrder 1) is not licensed, but the lesson is a sample.
    const gate = await checkLessonPreviewLicense("sch_1", "2025/2026", 1, true);
    expect(gate.allowed).toBe(true);
    expect(mockPrisma.schoolLicense.findMany).not.toHaveBeenCalled();
  });

  it("allows a non-sample lesson when its term is licensed", async () => {
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ termNumber: 1 })]);
    const gate = await checkLessonPreviewLicense("sch_1", "2025/2026", 0, false); // term 1
    expect(gate.allowed).toBe(true);
  });

  it("denies a non-sample lesson on an unlicensed term", async () => {
    mockPrisma.schoolLicense.findMany.mockResolvedValue([lic({ termNumber: 1 })]);
    const gate = await checkLessonPreviewLicense("sch_1", "2025/2026", 1, false); // term 2
    expect(gate.allowed).toBe(false);
  });
});

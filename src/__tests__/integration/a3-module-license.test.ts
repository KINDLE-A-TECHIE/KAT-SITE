import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getLicensedTermNumbers,
  checkModuleLicenseForEnrollment,
} from "@/lib/school-license";
import { termNumberForModule } from "@/lib/school-term";

/**
 * A3 live check: the REAL per-module gate against the REAL seeded school (Demo Academy, session
 * 2025/2026 with Term 1 + Term 2 licensed, Term 3 not). Confirms that on real data every module is
 * openable IFF its term is licensed, and that the seeded state actually exercises both sides (some
 * licensed, some not), so the assertion is meaningful. Run manually (integration/ is out of `npm test`).
 */
describe("A3 per-module gate on live seeded data", () => {
  it("allows a module's lesson iff its term is licensed", async () => {
    const enrollment = await prisma.enrollment.findFirst({
      where: { schoolClassId: "seed-demo-jss-class" },
      select: { schoolId: true, schoolClassId: true, programId: true, schoolClass: { select: { sessionLabel: true } } },
    });
    expect(enrollment, "seed a pupil in seed-demo-jss-class first").toBeTruthy();

    const licensedTerms = await getLicensedTermNumbers(
      enrollment!.schoolId!,
      enrollment!.schoolClass!.sessionLabel,
    );

    const curriculum = await prisma.curriculum.findUnique({
      where: { programId: enrollment!.programId! },
      select: {
        versions: {
          where: { isActive: true },
          take: 1,
          select: { modules: { orderBy: { sortOrder: "asc" }, select: { sortOrder: true } } },
        },
      },
    });
    const modules = curriculum?.versions[0]?.modules ?? [];
    expect(modules.length).toBeGreaterThan(0);

    let sawLicensed = false;
    let sawLocked = false;
    for (const m of modules) {
      const gate = await checkModuleLicenseForEnrollment(enrollment!, m.sortOrder);
      const shouldAllow = licensedTerms.has(termNumberForModule(m.sortOrder));
      expect(gate.allowed).toBe(shouldAllow);
      if (shouldAllow) sawLicensed = true;
      else sawLocked = true;
    }

    // The seeded state must exercise BOTH sides or the test proves nothing.
    expect(sawLicensed, "expected at least one licensed term").toBe(true);
    expect(sawLocked, "expected at least one locked term (Term 3 unlicensed)").toBe(true);
  });
});

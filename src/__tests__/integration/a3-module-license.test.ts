import { describe, it, expect, beforeAll } from "vitest";
import { CourseAudience } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getLicensedTermNumbers,
  checkModuleLicenseForEnrollment,
} from "@/lib/school-license";
import { termNumberForModule } from "@/lib/school-term";
import { syncRoster } from "@/lib/roster-sync";

/**
 * A3 live check: the REAL per-module gate against the REAL seeded school (Demo Academy, session
 * 2025/2026 with Term 1 + Term 2 licensed, Term 3 not). Confirms that on real data every module is
 * openable IFF its term is licensed, and that the seeded state actually exercises both sides (some
 * licensed, some not), so the assertion is meaningful. Run manually (integration/ is out of `npm test`).
 */
describe("A3 per-module gate on live seeded data", () => {
  // The seed builds the demo school (class + a Term 1 licence + the NERDC curriculum) but rosters no
  // pupil, so this check has nothing to gate. Enrol one through the CANONICAL path (syncRoster, the only
  // way a school child may be created, per CLAUDE.md), so the test runs against a complete tenant. The
  // seed itself cannot do this: roster-sync is `server-only`, which vitest stubs but a plain seed cannot.
  // Idempotent: a re-run assigns the course only if unset and skips the already-enrolled pupil.
  beforeAll(async () => {
    const cls = await prisma.schoolClass.findUnique({
      where: { id: "seed-demo-jss-class" },
      select: { schoolId: true, programId: true },
    });
    if (!cls) throw new Error("Run `npm run prisma:seed` first: the demo school class is missing.");

    // A class enrols into ONE course; JSS has several, so assign the JSS 1 course deterministically to
    // match "JSS 1 Blue" (resolveClassProgram would otherwise refuse an ambiguous auto-pick).
    if (!cls.programId) {
      const program = await prisma.program.findFirst({
        where: { slug: "nerdc-jss-1", audience: CourseAudience.SCHOOL },
        select: { id: true },
      });
      if (!program) throw new Error("Run `npm run prisma:seed` first: the NERDC JSS 1 course is missing.");
      await prisma.schoolClass.update({ where: { id: "seed-demo-jss-class" }, data: { programId: program.id } });
    }

    const result = await syncRoster({
      schoolId: cls.schoolId,
      schoolClassId: "seed-demo-jss-class",
      candidates: [{ ref: "a3", name: "A3 Test Pupil", externalRef: "a3-seed-pupil" }],
    });
    if ("error" in result) throw new Error(`Could not roster the A3 test pupil: ${result.error}`);
    // syncRoster runs an interactive $transaction (up to ~20s); the default 10s hook timeout is too short.
  }, 60_000);

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

import { GateStatus, Strand } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSchoolStudent } from "@/lib/school";
import { checkClassLicense } from "@/lib/school-license";
import { getModuleGatesForUser } from "@/lib/mastery";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/school/learn, what a school student's class is studying.
 *
 * Returns the class, its assigned course, and the course's modules with their
 * NERDC strand + the student's own progress. Lesson CONTENT is not served here,
 * the existing curriculum engine (/api/curriculum/*) does that, and this route
 * exists only to tell the learner shell which course and units to show.
 *
 * Guarded by ensureSchoolStudent (enrollment-based, school students hold no
 * SchoolMembership) and gated behind an ACTIVE licence.
 */
export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await ensureSchoolStudent());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();

  try {
    // The enrollment is read first, because the licence gate is keyed on the TERM of
    // the class this student is in, seats are bought per term.
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId: session!.user.id, schoolId },
      select: {
        programId: true,
        program: { select: { id: true, name: true, strand: true } },
        schoolClass: { select: { id: true, name: true, term: true, nerdcLevel: true } },
      },
    });
    if (!enrollment) return fail("You are not enrolled in a class.", 404);

    const access = await checkClassLicense(schoolId, enrollment.schoolClass?.term ?? null);
    if (!access.allowed) {
      return ok({
        licensed: false,
        code: access.code,
        reason: access.reason,
        class: enrollment.schoolClass,
        modules: [],
      });
    }

    const curriculum = await prisma.curriculum.findUnique({
      where: { programId: enrollment.programId },
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
                description: true,
                strand: true,
                lessons: {
                  orderBy: { sortOrder: "asc" },
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
    });

    const rawModules = curriculum?.versions[0]?.modules ?? [];
    const lessonIds = rawModules.flatMap((m) => m.lessons.map((l) => l.id));

    const [completed, gates] = await Promise.all([
      lessonIds.length > 0
        ? prisma.lessonProgress.findMany({
            where: { userId: session!.user.id, lessonId: { in: lessonIds } },
            select: { lessonId: true },
          })
        : Promise.resolve([] as Array<{ lessonId: string }>),
      getModuleGatesForUser(
        session!.user.id,
        rawModules.map((m) => m.id),
      ),
    ]);

    const completedIds = new Set(completed.map((c) => c.lessonId));

    // getModuleGatesForUser only returns rows for modules the student has already
    // started, so a fresh CODING unit has no record. Default it to NOT_STARTED,
    // otherwise a not-yet-begun coding unit would render gate-less, exactly like a
    // DIGLIT unit, and the whole strand distinction would be invisible.
    const NO_GATES_YET = {
      assessmentGate: GateStatus.NOT_STARTED,
      projectGate: GateStatus.NOT_STARTED,
      instructorGate: GateStatus.NOT_STARTED,
      allGatesPassed: false,
    };

    const modules = rawModules.map((m) => {
      // A module's strand falls back to the course's strand when not set on the unit.
      const strand = m.strand ?? enrollment.program.strand ?? Strand.CODING;
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        strand,
        // Gates only apply to CODING units. DIGLIT units are slides/worksheets:
        // read and mark complete, no assessment/project/instructor gate.
        gates: strand === Strand.CODING ? (gates[m.id] ?? NO_GATES_YET) : null,
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          completed: completedIds.has(l.id),
        })),
      };
    });

    return ok({
      licensed: true,
      class: enrollment.schoolClass,
      program: enrollment.program,
      modules,
    });
  } catch (error) {
    captureError(error);
    return fail("Could not load your learning.", 500);
  }
}

import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { getLicensedTermNumbers } from "@/lib/school-license";
import { termNumberForModule } from "@/lib/school-term";

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

/**
 * GET /api/school/certificates/eligible?classId=..., pupils in a class who have completed a LICENSED
 * term and do not yet hold its certificate, so a SCHOOL_ADMIN can issue.
 *
 * Minors' data: only the classId is in the query (never a pupil id or name), and everything is scoped
 * to the caller's school. Pupil identity is resolved server-side and returned in the response BODY,
 * keyed on the opaque userId; the name is what the school's own admin needs to pick who to certify and
 * never leaves this authenticated, tenant-scoped response (not a URL, query string, log, or public API).
 */
export async function GET(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return fail("classId is required.", 400);

  // TENANT ISOLATION: another school's class does not exist to this admin.
  const cls = await prisma.schoolClass.findFirst({
    where: { id: classId, schoolId },
    select: { id: true, name: true, sessionLabel: true, programId: true },
  });
  if (!cls?.programId) return fail("Class not found.", 404);

  const licensedTerms = await getLicensedTermNumbers(schoolId, cls.sessionLabel);

  const modules = await prisma.module.findMany({
    where: { version: { curriculum: { programId: cls.programId } } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, sortOrder: true, lessons: { select: { id: true } } },
  });
  const licensedModules = modules
    .map((m) => ({ ...m, termNumber: termNumberForModule(m.sortOrder) }))
    .filter((m) => m.lessons.length > 0 && licensedTerms.has(m.termNumber));

  const pupils = await prisma.enrollment.findMany({
    where: { schoolClassId: classId, schoolId },
    select: { userId: true, externalRef: true, user: { select: { firstName: true, lastName: true } } },
  });

  // Capstone: pupils who hold a TERM certificate for EVERY module in the programme (all terms, not just
  // the licensed ones) and do not yet have the SESSION certificate. Built from the term certs, so it
  // inherits their licence/completion gating.
  const allModuleCount = modules.length;
  const pupilIdsAll = pupils.map((p) => p.userId);
  const [termCertCounts, sessionCerts] = await Promise.all([
    prisma.schoolCertificate.groupBy({
      by: ["userId"],
      where: {
        userId: { in: pupilIdsAll },
        kind: "TERM",
        status: "ISSUED",
        module: { version: { curriculum: { programId: cls.programId } } },
      },
      _count: { _all: true },
    }),
    prisma.schoolCertificate.findMany({
      where: { userId: { in: pupilIdsAll }, kind: "SESSION", programId: cls.programId },
      select: { userId: true },
    }),
  ]);
  const termCountByUser = new Map(termCertCounts.map((r) => [r.userId, r._count._all]));
  const hasSession = new Set(sessionCerts.map((c) => c.userId));
  const capstoneCandidates = pupils
    .filter((p) => allModuleCount > 0 && (termCountByUser.get(p.userId) ?? 0) >= allModuleCount && !hasSession.has(p.userId))
    .map((p) => ({
      userId: p.userId,
      name: `${p.user.firstName ?? ""} ${p.user.lastName ?? ""}`.trim() || "Pupil",
      externalRef: p.externalRef,
      programId: cls.programId!,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (pupils.length === 0 || (licensedModules.length === 0 && capstoneCandidates.length === 0)) {
    return ok({ className: cls.name, sessionLabel: cls.sessionLabel, candidates: [], capstoneCandidates });
  }

  const pupilIds = pupils.map((p) => p.userId);
  const allLessonIds = licensedModules.flatMap((m) => m.lessons.map((l) => l.id));

  // Completed lessons per pupil, and already-issued certs to exclude, in two bounded queries.
  const progress = await prisma.lessonProgress.findMany({
    where: { userId: { in: pupilIds }, lessonId: { in: allLessonIds } },
    select: { userId: true, lessonId: true },
  });
  const doneByUser = new Map<string, Set<string>>();
  for (const p of progress) {
    const set = doneByUser.get(p.userId) ?? new Set<string>();
    set.add(p.lessonId);
    doneByUser.set(p.userId, set);
  }

  const issued = await prisma.schoolCertificate.findMany({
    where: { userId: { in: pupilIds }, moduleId: { in: licensedModules.map((m) => m.id) } },
    select: { userId: true, moduleId: true },
  });
  const issuedKey = new Set(issued.map((c) => `${c.userId}:${c.moduleId}`));

  const candidates: {
    userId: string;
    name: string;
    externalRef: string | null;
    moduleId: string;
    moduleTitle: string;
    termNumber: number;
  }[] = [];

  for (const pupil of pupils) {
    const done = doneByUser.get(pupil.userId) ?? new Set<string>();
    for (const m of licensedModules) {
      if (issuedKey.has(`${pupil.userId}:${m.id}`)) continue;
      if (!m.lessons.every((l) => done.has(l.id))) continue;
      candidates.push({
        userId: pupil.userId,
        name: `${pupil.user.firstName ?? ""} ${pupil.user.lastName ?? ""}`.trim() || "Pupil",
        externalRef: pupil.externalRef,
        moduleId: m.id,
        moduleTitle: m.title,
        termNumber: m.termNumber,
      });
    }
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name) || a.termNumber - b.termNumber);

  return ok({ className: cls.name, sessionLabel: cls.sessionLabel, candidates, capstoneCandidates });
}

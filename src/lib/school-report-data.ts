import "server-only";
import { SchoolLicenseStatus, SchoolRole } from "@prisma/client";
import { prisma } from "./prisma";
import { getClassTermSummary, type ClassTermSummary } from "./school-report";
import { getClassCoverage, type ClassCoverage } from "./school-coverage";
import { formatTerm, normalizeSession } from "./school-term";

/**
 * The assembled termly progress & NERDC-coverage report, shared by BOTH the JSON route
 * (/api/school/reports) and the server-PDF route (/api/school/reports/pdf) so the two can
 * never diverge. Everything is derived from a schoolId-filtered class query, never from ids
 * supplied by the caller; a teacher is additionally scoped to their own classes.
 */

export type SchoolReportSection = { summary: ClassTermSummary; coverage: ClassCoverage };

export type SchoolReport = {
  school: { name: string };
  session: string | null;
  scope: "class" | "school";
  licence: { term: string; status: SchoolLicenseStatus; seatLimit: number; seatsUsed: number } | null;
  generatedAt: string;
  classes: SchoolReportSection[];
};

/** Thrown when a caller asks for a specific classId that is not in their scope (404, not 500). */
export class ReportClassNotFoundError extends Error {}

export async function getSchoolReport(
  schoolId: string,
  role: SchoolRole,
  userId: string,
  opts: { session?: string | null; classId?: string | null },
): Promise<SchoolReport> {
  const { session = null, classId = null } = opts;

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });

  // The set of classes in scope. Always filtered by schoolId, and additionally by teacherId for a
  // teacher: a schoolId filter alone would let a teacher report on a colleague's class.
  const classes = await prisma.schoolClass.findMany({
    where: {
      schoolId,
      ...(classId ? { id: classId } : {}),
      ...(role === SchoolRole.TEACHER ? { teacherId: userId } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, sessionLabel: true },
  });

  // Session labels are free text, so filter on the normalized form.
  const wanted = session ? normalizeSession(session) : null;
  const inScope = wanted ? classes.filter((c) => normalizeSession(c.sessionLabel) === wanted) : classes;

  if (classId && inScope.length === 0) {
    throw new ReportClassNotFoundError("Class not found.");
  }

  const sections = await Promise.all(
    inScope.map(async (c) => {
      const [summary, coverage] = await Promise.all([
        getClassTermSummary(schoolId, c.id),
        getClassCoverage(schoolId, c.id),
      ]);
      return summary && coverage ? { summary, coverage } : null;
    }),
  );

  // The session's licence to show: the ACTIVE one if any, else its most-recent term.
  const licences = await prisma.schoolLicense.findMany({
    where: { schoolId },
    orderBy: { termNumber: "desc" },
    select: { sessionLabel: true, termNumber: true, status: true, seatLimit: true, seatsUsed: true },
  });
  const forSession = wanted ? licences.filter((l) => normalizeSession(l.sessionLabel) === wanted) : [];
  const chosen = forSession.find((l) => l.status === SchoolLicenseStatus.ACTIVE) ?? forSession[0] ?? null;
  const licence = chosen
    ? {
        term: formatTerm(chosen.sessionLabel, chosen.termNumber),
        status: chosen.status,
        seatLimit: chosen.seatLimit,
        seatsUsed: chosen.seatsUsed,
      }
    : null;

  return {
    school: { name: school?.name ?? "" },
    session,
    scope: classId ? "class" : "school",
    licence,
    generatedAt: new Date().toISOString(),
    classes: sections.filter((s): s is SchoolReportSection => s !== null),
  };
}

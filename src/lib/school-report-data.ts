import "server-only";
import { SchoolLicenseStatus, SchoolRole } from "@prisma/client";
import { prisma } from "./prisma";
import { getClassTermSummary, type ClassTermSummary } from "./school-report";
import { getClassCoverage, type ClassCoverage } from "./school-coverage";
import { normalizeTerm } from "./school-license";

/**
 * The assembled termly progress & NERDC-coverage report, shared by BOTH the JSON route
 * (/api/school/reports) and the server-PDF route (/api/school/reports/pdf) so the two can
 * never diverge. Everything is derived from a schoolId-filtered class query, never from ids
 * supplied by the caller; a teacher is additionally scoped to their own classes.
 */

export type SchoolReportSection = { summary: ClassTermSummary; coverage: ClassCoverage };

export type SchoolReport = {
  school: { name: string };
  term: string | null;
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
  opts: { term?: string | null; classId?: string | null },
): Promise<SchoolReport> {
  const { term = null, classId = null } = opts;

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
    select: { id: true, term: true },
  });

  // Term is free text, so filter on the normalized form.
  const wanted = term ? normalizeTerm(term) : null;
  const inScope = wanted ? classes.filter((c) => normalizeTerm(c.term) === wanted) : classes;

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

  const licences = await prisma.schoolLicense.findMany({
    where: { schoolId },
    select: { term: true, status: true, seatLimit: true, seatsUsed: true },
  });
  const licence = wanted ? (licences.find((l) => normalizeTerm(l.term) === wanted) ?? null) : null;

  return {
    school: { name: school?.name ?? "" },
    term,
    scope: classId ? "class" : "school",
    licence,
    generatedAt: new Date().toISOString(),
    classes: sections.filter((s): s is SchoolReportSection => s !== null),
  };
}

import { SchoolRole } from "@prisma/client";
import { fail } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { requireActiveSchool } from "@/lib/school";
import { getSchoolReport, ReportClassNotFoundError } from "@/lib/school-report-data";
import { renderSchoolReportPdf } from "@/lib/school-report-pdf";
import { captureError } from "@/lib/sentry";

// @react-pdf/renderer needs the Node runtime (not Edge).
export const runtime = "nodejs";

/**
 * GET /api/school/reports/pdf?term=…&classId=…
 *
 * Server-generated PDF of the termly progress & NERDC-coverage report. Same authorization and
 * STRICT schoolId scoping as the JSON /api/school/reports route (they share getSchoolReport):
 *   SCHOOL_ADMIN → any class in their school; TEACHER → their own classes only (schoolId AND teacherId).
 * Only class ids and the term travel in the query string, never a student's id or name.
 */
export async function GET(request: Request) {
  let schoolId: string;
  let role: SchoolRole;
  try {
    ({ schoolId, role } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN, SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();
  const url = new URL(request.url);
  const sessionLabel = url.searchParams.get("session");
  const classId = url.searchParams.get("classId");

  try {
    const report = await getSchoolReport(schoolId, role, session!.user.id, { session: sessionLabel, classId });
    const pdf = await renderSchoolReportPdf(report);

    const slug = (report.school.name || "school").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const sessionSlug = sessionLabel ? "-" + sessionLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") : "";
    const filename = `kat-report-${slug}${sessionSlug}.pdf`;

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ReportClassNotFoundError) return fail("Class not found.", 404);
    captureError(error);
    return fail("Could not build the report PDF.", 500);
  }
}

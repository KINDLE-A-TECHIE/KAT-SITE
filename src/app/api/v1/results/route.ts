import { NextResponse } from "next/server";
import { SchoolApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, authorizeV1, readPaging } from "@/lib/api-v1";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/v1/results, assessment results for the school's pupils.
 *
 * Optional `class_id` filter. NOTE what is NOT a filter: a name, an email, or anything else that
 * would put a child's identity in a query string.
 *
 * TENANT ISOLATION: submissions are reached only through enrollments carrying the key's schoolId.
 * A B2C child's submission cannot appear here, and neither can another school's, the join starts
 * from `where: { schoolId }`, not from the assessment.
 */
export async function GET(request: Request) {
  const auth = await authorizeV1(request, SchoolApiScope.RESULTS_READ);
  if (auth instanceof NextResponse) return auth;
  const { schoolId } = auth.caller;

  const { limit, cursor } = readPaging(request);
  const classId = new URL(request.url).searchParams.get("class_id");

  try {
    // Start from the school's own enrollments. This is the tenant boundary: everything below is
    // reachable only through pupils who belong to THIS school.
    const enrollments = await prisma.enrollment.findMany({
      where: { schoolId, ...(classId ? { schoolClassId: classId } : {}) },
      select: { userId: true, externalRef: true, schoolClassId: true },
    });
    if (enrollments.length === 0) {
      return apiOk({ data: [], hasMore: false, nextCursor: null });
    }

    const refByUser = new Map(enrollments.map((e) => [e.userId, e.externalRef]));
    const classByUser = new Map(enrollments.map((e) => [e.userId, e.schoolClassId]));

    const submissions = await prisma.assessmentSubmission.findMany({
      where: { studentId: { in: [...refByUser.keys()] } },
      orderBy: { id: "asc" },
      take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        studentId: true,
        totalScore: true,
        status: true,
        submittedAt: true,
        gradedAt: true,
        assessment: { select: { id: true, title: true, totalPoints: true, passScore: true } },
      },
    });

    const hasMore = submissions.length > limit;
    const page = hasMore ? submissions.slice(0, limit) : submissions;

    return apiOk({
      data: page.map((s) => ({
        id: s.id,
        // Identified by the school's own ref, never by our internal user id.
        student_id: refByUser.get(s.studentId) ?? null,
        class_id: classByUser.get(s.studentId) ?? null,
        assessment_id: s.assessment.id,
        assessment_title: s.assessment.title,
        score: s.totalScore,
        total_points: s.assessment.totalPoints,
        passed: s.totalScore >= s.assessment.passScore,
        status: s.status,
        submitted_at: s.submittedAt?.toISOString() ?? null,
        graded_at: s.gradedAt?.toISOString() ?? null,
      })),
      hasMore,
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    });
  } catch (error) {
    captureError(error);
    return apiError("Could not load results.", 500, "internal_error");
  }
}

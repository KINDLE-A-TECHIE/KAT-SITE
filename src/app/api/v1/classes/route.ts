import { NextResponse } from "next/server";
import { SchoolApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, authorizeV1, readPaging } from "@/lib/api-v1";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/v1/classes, the school's classes.
 *
 * TENANT ISOLATION: schoolId comes from the API KEY. There is nowhere in this request a caller
 * could name another school, no schoolId is read from the path, the query, or the body.
 */
export async function GET(request: Request) {
  const auth = await authorizeV1(request, SchoolApiScope.CLASSES_READ);
  if (auth instanceof NextResponse) return auth;
  const { schoolId } = auth.caller;

  const { limit, cursor } = readPaging(request);

  try {
    const classes = await prisma.schoolClass.findMany({
      where: { schoolId },
      orderBy: { id: "asc" },
      take: limit + 1, // one extra, to know whether another page exists
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        nerdcLevel: true,
        sessionLabel: true,
        programId: true,
        teacher: { select: { firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
    });

    const hasMore = classes.length > limit;
    const page = hasMore ? classes.slice(0, limit) : classes;

    return apiOk({
      data: page.map((c) => ({
        id: c.id,
        name: c.name,
        nerdc_level: c.nerdcLevel,
        // A class is a session cohort; `session` is the academic year it runs in ("2025/2026").
        session: c.sessionLabel,
        course_id: c.programId,
        // A teacher's name, not a child's. The school employs them; this is their own staff list.
        teacher: c.teacher ? `${c.teacher.firstName} ${c.teacher.lastName}`.trim() : null,
        student_count: c._count.enrollments,
      })),
      has_more: hasMore,
      next_cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    });
  } catch (error) {
    captureError(error);
    return apiError("Could not list classes.", 500, "internal_error");
  }
}

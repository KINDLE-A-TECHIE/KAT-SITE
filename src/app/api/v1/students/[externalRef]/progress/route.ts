import { NextResponse } from "next/server";
import { SchoolApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk, authorizeV1 } from "@/lib/api-v1";
import { captureError } from "@/lib/sentry";

/**
 * GET /api/v1/students/{student_id}/progress, one pupil's progress.
 *
 * `student_id` is the school's OWN opaque ref (Enrollment.externalRef), in the PATH, the same
 * convention as every REST API (`/v1/customers/cus_123`). It is not PII: it is a pseudonym that
 * means nothing outside its school. A name or an email in a URL WOULD be a violation, and no
 * endpoint here accepts one.
 *
 * TENANT ISOLATION: the ref is resolved WITHIN the key's schoolId. Another school's ref simply does
 * not resolve, refs are unique per school, not globally, so this is the only correct lookup.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalRef: string }> },
) {
  const auth = await authorizeV1(request, SchoolApiScope.PROGRESS_READ);
  if (auth instanceof NextResponse) return auth;
  const { schoolId } = auth.caller;

  const { externalRef } = await params;

  try {
    const enrollment = await prisma.enrollment.findFirst({
      where: { schoolId, externalRef },
      select: {
        userId: true,
        status: true,
        programId: true,
        schoolClassId: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!enrollment) return apiError("No pupil with that student_id.", 404, "not_found");

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
                strand: true,
                sortOrder: true,
                lessons: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    const modules = curriculum?.versions[0]?.modules ?? [];
    const lessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    const completions =
      lessonIds.length > 0
        ? await prisma.lessonProgress.findMany({
            where: { userId: enrollment.userId, lessonId: { in: lessonIds } },
            select: { lessonId: true, completedAt: true },
          })
        : [];

    const doneByLesson = new Map(completions.map((c) => [c.lessonId, c.completedAt]));

    const units = modules.map((m) => {
      const done = m.lessons.filter((l) => doneByLesson.has(l.id)).length;
      return {
        unit_id: m.id,
        title: m.title,
        strand: m.strand,
        order: m.sortOrder + 1,
        lessons_total: m.lessons.length,
        lessons_completed: done,
        percent_complete: m.lessons.length > 0 ? Math.round((done / m.lessons.length) * 100) : 0,
      };
    });

    const totalLessons = lessonIds.length;

    return apiOk({
      student_id: externalRef,
      // The school gave us this name; returning it tells them nothing they do not already hold.
      name: `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim(),
      status: enrollment.status,
      class_id: enrollment.schoolClassId,
      course_id: enrollment.programId,
      lessons_total: totalLessons,
      lessons_completed: completions.length,
      percent_complete:
        totalLessons > 0 ? Math.round((completions.length / totalLessons) * 100) : 0,
      units,
    });
  } catch (error) {
    captureError(error);
    return apiError("Could not load progress.", 500, "internal_error");
  }
}

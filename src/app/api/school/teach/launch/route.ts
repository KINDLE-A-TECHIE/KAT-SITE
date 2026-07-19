import { z } from "zod";
import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { mintStudentLaunch } from "@/lib/student-launch";
import { schoolLaunchOrigin } from "@/lib/request-host";
import { embedTokenLimiter, rateLimitResponse } from "@/lib/ratelimit";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/school/teach/launch, a teacher mints a one-tap sign-in for one of their pupils.
 *
 * AUTHORITY: the teacher must hold a TEACHER membership in the active school AND own the pupil's
 * class (schoolId + teacherId scope, the same double-scope the rest of /teach uses). The pupil is
 * named by enrollmentId; nothing in the body decides the school (that comes from the session), so a
 * teacher cannot mint for a child in another class or another school.
 *
 * The response carries a 60-second single-use launch URL with the token in the FRAGMENT (never a
 * query string: no child credential in a server log or Referer header). The teacher shows it as a
 * QR; the pupil's own device redeems it into a normal session.
 */
const bodySchema = z.object({ enrollmentId: z.string().min(1) });

/**
 * GET /api/school/teach/launch?classId=…, the pupils a teacher may launch.
 *
 * A teacher of THAT class may see their own pupils' names (this is their roster, not a public API);
 * the no-PII-in-URL rule governs URLs, logs, and the public v1 API, not an authenticated teacher's
 * view of the children they teach.
 */
export async function GET(request: Request) {
  const session = await getServerAuthSession();

  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const classId = new URL(request.url).searchParams.get("classId");
  if (!classId) return fail("classId is required.", 400);

  try {
    const owns = await prisma.schoolClass.findFirst({
      where: { id: classId, schoolId, teacherId: session!.user.id },
      select: { id: true },
    });
    if (!owns) return fail("Class not found.", 404);

    const enrollments = await prisma.enrollment.findMany({
      where: { schoolClassId: classId, schoolId, status: "ACTIVE" },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { firstName: "asc" } },
    });

    return ok({
      pupils: enrollments.map((e) => ({
        enrollmentId: e.id,
        name: `${e.user.firstName} ${e.user.lastName}`.trim(),
      })),
    });
  } catch (error) {
    captureError(error);
    return fail("Could not load the roster.", 500);
  }
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();

  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  if (embedTokenLimiter) {
    const { success, reset } = await embedTokenLimiter.limit(`launch:${session!.user.id}`);
    if (!success) return rateLimitResponse(reset);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return fail("enrollmentId is required.", 400);

    // TENANT + AUTHORITY: the enrollment must be in THIS school, ACTIVE, and in a class taught by
    // THIS teacher. A foreign enrollmentId simply matches zero rows.
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: parsed.data.enrollmentId,
        schoolId,
        status: "ACTIVE",
        schoolClass: { teacherId: session!.user.id },
      },
      select: { userId: true },
    });
    if (!enrollment) return fail("That pupil is not in one of your classes.", 404);

    const { token, expiresAt } = await mintStudentLaunch({ schoolId, userId: enrollment.userId });

    // Absolute URL on the PUBLIC school host so a scanned QR resolves from the pupil's phone.
    // schoolLaunchOrigin is the trusted host (fixed in production), so a forged Host cannot redirect
    // this single-use token to an attacker domain.
    const launchUrl = `${schoolLaunchOrigin(request)}/student-launch#t=${encodeURIComponent(token)}`;

    return ok({ launchUrl, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    captureError(error);
    return fail("Could not create the sign-in link.", 500);
  }
}

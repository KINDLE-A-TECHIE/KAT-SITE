import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { normalizeJoinCode } from "@/lib/student-pin";
import { studentRosterLimiter, getClientIp, rateLimitResponse } from "@/lib/ratelimit";

/**
 * GET /api/school/student-login/roster?code=…, the pupils in a class, for the pre-login
 * "pick your name" step of PIN sign-in (Option B).
 *
 * DELIBERATELY PUBLIC: the pupil has no session yet. It is not a tenant leak because it is gated by
 * the teacher-controlled join code (which maps to exactly one class in one school) and returns only
 * first name + last initial, never a full surname, email, or any id that means anything off this
 * screen. `ref` is the opaque enrollment id the PIN step needs; the PIN is the actual secret. Rate-
 * limited so a guessed code cannot be farmed for names. Allowlisted in the route-authorization test
 * with this justification.
 */
export async function GET(request: Request) {
  if (studentRosterLimiter) {
    const { success, reset } = await studentRosterLimiter.limit(getClientIp(request));
    if (!success) return rateLimitResponse(reset);
  }

  const raw = new URL(request.url).searchParams.get("code") ?? "";
  const code = normalizeJoinCode(raw);
  if (code.length < 4) return fail("Enter your class code.", 400);

  const schoolClass = await prisma.schoolClass.findUnique({
    where: { joinCode: code },
    select: { id: true, name: true },
  });
  // Same 404 whether the code is unknown or malformed: never confirm a code exists without a match.
  if (!schoolClass) return fail("We couldn't find that class code.", 404);

  // Only pupils who actually have a PIN can sign in, so only they belong on the picker.
  const enrollments = await prisma.enrollment.findMany({
    where: { schoolClassId: schoolClass.id, status: "ACTIVE", studentCredential: { isNot: null } },
    select: { id: true, user: { select: { firstName: true, lastName: true } } },
    orderBy: { user: { firstName: "asc" } },
  });

  return ok({
    className: schoolClass.name,
    pupils: enrollments.map((e) => ({
      ref: e.id,
      firstName: e.user.firstName,
      lastInitial: e.user.lastName ? `${e.user.lastName.charAt(0).toUpperCase()}.` : "",
    })),
  });
}

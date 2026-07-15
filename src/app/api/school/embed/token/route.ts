import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { apiKeyFromRequest, schoolIdForApiKey } from "@/lib/school-api-key";
import { mintLaunchToken } from "@/lib/school-embed";
import { embedTokenLimiter, getClientIp, rateLimitResponse } from "@/lib/ratelimit";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/school/embed/token, the school's SERVER mints a launch token for one of its pupils.
 *
 * Authenticated by SchoolApiKey (`Authorization: Bearer kat_sk_…`), NOT by a user session. This is
 * a server-to-server call and the key must never reach a browser: it can mint a launch token for
 * ANY pupil in the school.
 *
 * TENANT ISOLATION: schoolId is derived from the API KEY, never from the request body. The caller
 * says which pupil (`ref`), and we look that pupil up WITHIN the key's school. A body-supplied
 * schoolId would let any school with a valid key mint a session for any child anywhere.
 *
 * ENUMERATION: `ref` is the school's own opaque externalRef. Name and email are deliberately NOT
 * accepted, a mint endpoint that takes an email is an oracle for which children attend the school.
 * An unknown ref returns the same 404 as a ref belonging to another school.
 */

const bodySchema = z.object({
  /** The school's own opaque id for the pupil (Enrollment.externalRef). */
  ref: z.string().trim().min(1).max(128),
  /** v1 is learner-only. A teacher embed would put a roster of minors on a page we don't control. */
  purpose: z.literal("learn").default("learn"),
});

export async function POST(request: Request) {
  const rawKey = apiKeyFromRequest(request);

  // Rate-limited on the key prefix where we have one, else the IP, so a stolen key cannot be used
  // to farm launch tokens for a whole school, and a missing key cannot be brute-forced.
  if (embedTokenLimiter) {
    const limitKey = rawKey ? rawKey.slice(0, 12) : getClientIp(request);
    const { success, reset } = await embedTokenLimiter.limit(limitKey);
    if (!success) return rateLimitResponse(reset);
  }

  const schoolId = await schoolIdForApiKey(rawKey);
  if (!schoolId) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid payload.", 400, parsed.error.flatten());
  }
  const { ref, purpose } = parsed.data;

  try {
    // The pupil, looked up INSIDE the key's school.
    const enrollment = await prisma.enrollment.findFirst({
      where: { schoolId, externalRef: ref, status: "ACTIVE" },
      select: { userId: true },
    });
    // Deliberately the same response as "no such pupil", do not reveal whether a ref exists
    // elsewhere on the platform.
    if (!enrollment) return fail("No active pupil with that reference at this school.", 404);

    const { token, expiresAt } = await mintLaunchToken({
      schoolId,
      userId: enrollment.userId,
      purpose,
    });

    // No pupil name, no email, no id in the response, the school already knows its own ref, and
    // a mint response is a place PII would silently accumulate in someone's server log.
    return ok({ token, expiresAt: expiresAt.toISOString(), expiresIn: 60 });
  } catch (error) {
    captureError(error);
    return fail("Could not mint a launch token.", 500);
  }
}

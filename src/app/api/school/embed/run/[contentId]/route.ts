import { fail, ok } from "@/lib/http";
import { resolveEmbedPupil, assertContentOnPupilProgramme } from "@/lib/school-embed-pupil";
import { runOnJudge0 } from "@/lib/judge0";
import { embedRunLimiter, rateLimitResponse } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ contentId: string }> }

/**
 * Run a pupil's code from INSIDE the embed (server languages via Judge0; Python/web run client-side and
 * never reach here). The embed has no NextAuth session, so this mirrors /api/curriculum/contents/[id]/run
 * but authenticates with the embed session and scopes the content to the pupil's own licensed programme.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  if (embedRunLimiter) {
    const { success, reset } = await embedRunLimiter.limit(auth.pupil.userId);
    if (!success) return rateLimitResponse(reset);
  }

  const { contentId } = await params;
  const found = await assertContentOnPupilProgramme(contentId, auth.pupil.enrollment);
  if (!found.ok) return fail(found.error, found.status);
  const content = found.content;

  if (content.type !== "CODE_PLAYGROUND") return fail("Not a code playground.", 400);
  if (!content.language) return fail("No language set for this playground.", 400);
  // The programme scope already implies PUBLISHED for a pupil, but be explicit.
  if (content.reviewStatus !== "PUBLISHED") return fail("Content not published.", 403);

  const body = (await request.json().catch(() => null)) as { code?: string; stdin?: string; additional_files?: string } | null;
  if (!body?.code || typeof body.code !== "string") return fail("code is required.", 400);
  if (body.code.length > 50_000) return fail("Code too long (max 50 000 chars).", 400);
  if (body.additional_files && typeof body.additional_files !== "string") {
    return fail("additional_files must be a base64 string.", 400);
  }

  const outcome = await runOnJudge0({
    language: content.language,
    code: body.code,
    stdin: body.stdin,
    additionalFiles: body.additional_files,
  });
  if (!outcome.ok) return fail(outcome.error, outcome.status);
  return ok(outcome.result);
}

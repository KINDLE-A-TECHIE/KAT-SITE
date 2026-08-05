import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { stageVideoKey, STAGE_VIDEO_CONTENT_TYPE, MAX_STAGE_VIDEO_BYTES } from "@/lib/video-storage";
import { stageVideoUploadLimiter, rateLimitResponse } from "@/lib/ratelimit";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const schema = z.object({
  sizeBytes: z.number().int().positive().max(MAX_STAGE_VIDEO_BYTES, { message: "Recording too large (max 80 MB)." }),
});

/**
 * Mint a presigned PUT URL for the current user to save one stage-video recording. The editor's recorder
 * PUTs the .webm straight to R2; the bytes never touch the server. The key is minted under the user's own
 * namespace (videos/<userId>/...), so a user can only ever write their own. Rate-limited: recordings are
 * heavy, so a low per-user hourly ceiling. The DB row is created only AFTER the PUT, via POST /api/videos.
 */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  if (stageVideoUploadLimiter) {
    const { success, reset } = await stageVideoUploadLimiter.limit(session.user.id);
    if (!success) return rateLimitResponse(reset);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid payload.", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  try {
    const key = stageVideoKey(session.user.id);
    // The signed content-type MUST match what the recorder PUTs, or the signature is rejected.
    const uploadUrl = await generatePresignedUploadUrl(key, STAGE_VIDEO_CONTENT_TYPE);
    return ok({ uploadUrl, key });
  } catch (error) {
    captureError(error);
    return fail("Could not prepare the upload. Please try again.", 500);
  }
}

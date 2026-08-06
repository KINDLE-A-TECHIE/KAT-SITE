import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { resolveEmbedPupil } from "@/lib/school-embed-pupil";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { stageVideoKey, STAGE_VIDEO_CONTENT_TYPE, MAX_STAGE_VIDEO_BYTES } from "@/lib/video-storage";
import { stageVideoUploadLimiter, rateLimitResponse } from "@/lib/ratelimit";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const schema = z.object({
  sizeBytes: z.number().int().positive().max(MAX_STAGE_VIDEO_BYTES, { message: "Recording too large (max 80 MB)." }),
});

/**
 * Mint a presigned PUT so a pupil can save one stage recording, from INSIDE the embed. Mirrors
 * /api/videos/upload-url but authed by the embed session. The key is minted under the pupil's own
 * namespace (videos/<userId>/...), so a pupil can only ever write their own; rate-limited per pupil.
 */
export async function POST(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  if (stageVideoUploadLimiter) {
    const { success, reset } = await stageVideoUploadLimiter.limit(auth.pupil.userId);
    if (!success) return rateLimitResponse(reset);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  try {
    const key = stageVideoKey(auth.pupil.userId);
    const uploadUrl = await generatePresignedUploadUrl(key, STAGE_VIDEO_CONTENT_TYPE);
    return ok({ uploadUrl, key });
  } catch (error) {
    captureError(error);
    return fail("Could not prepare the upload. Please try again.", 500);
  }
}

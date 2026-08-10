import { fail, ok } from "@/lib/http";
import { resolveEmbedPupil, assertContentOnPupilProgramme } from "@/lib/school-embed-pupil";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { scratchProjectKey, SCRATCH_SB3_CONTENT_TYPE } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ contentId: string }> }

/**
 * Mint a presigned PUT so a pupil can save their Scratch project for a SCRATCH lesson block, from INSIDE
 * the embed. Mirrors /api/curriculum/contents/[id]/scratch/upload-url but authed by the embed session and
 * scoped to the pupil's own licensed programme. The key is minted under the pupil's own namespace, so a
 * pupil can only ever write their own project; the editor PUTs the .sb3 straight to R2 (bytes never touch us).
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const { contentId } = await params;
  const found = await assertContentOnPupilProgramme(contentId, auth.pupil.enrollment);
  if (!found.ok) return fail(found.error, found.status);
  if (found.content.type !== "SCRATCH") return fail("Not found.", 404);

  try {
    const key = scratchProjectKey(auth.pupil.userId, contentId);
    const uploadUrl = await generatePresignedUploadUrl(key, SCRATCH_SB3_CONTENT_TYPE);
    return ok({ uploadUrl, key });
  } catch (error) {
    captureError(error);
    return fail("Could not prepare the save. Please try again.", 500);
  }
}

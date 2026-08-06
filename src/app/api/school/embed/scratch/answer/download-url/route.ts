import { fail, ok } from "@/lib/http";
import { resolveEmbedPupil } from "@/lib/school-embed-pupil";
import { generatePresignedDownloadUrl } from "@/lib/r2";
import { isOwnScratchAnswerKey } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived presigned GET so the editor can reload a pupil's saved Scratch answer, from INSIDE the
 * embed. Signed only after proving the key is THIS pupil's own (isOwnScratchAnswerKey), so it can never
 * read another pupil's work.
 */
export async function POST(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  if (!isOwnScratchAnswerKey(body?.key, auth.pupil.userId)) return fail("Not found.", 404);

  try {
    const projectUrl = await generatePresignedDownloadUrl(body!.key as string);
    return ok({ projectUrl });
  } catch (error) {
    captureError(error);
    return fail("Could not open the project. Please try again.", 500);
  }
}

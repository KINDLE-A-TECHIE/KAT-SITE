import { fail, ok } from "@/lib/http";
import { resolveEmbedPupil, assertContentOnPupilProgramme } from "@/lib/school-embed-pupil";
import { generatePresignedDownloadUrl } from "@/lib/r2";
import { isOwnScratchKey } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ contentId: string }> }

/**
 * Mint a short-lived presigned GET so the editor can reload a pupil's saved Scratch project, from INSIDE
 * the embed. The key comes from the request but is only signed after proving it is THIS pupil's own
 * (isOwnScratchKey), so it can never read another pupil's work. A child's project is never public.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const { contentId } = await params;
  const found = await assertContentOnPupilProgramme(contentId, auth.pupil.enrollment);
  if (!found.ok) return fail(found.error, found.status);
  if (found.content.type !== "SCRATCH") return fail("Not found.", 404);

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  if (!isOwnScratchKey(body?.key, auth.pupil.userId)) return fail("Not found.", 404);

  try {
    const projectUrl = await generatePresignedDownloadUrl(body!.key as string);
    return ok({ projectUrl });
  } catch (error) {
    captureError(error);
    return fail("Could not open the project. Please try again.", 500);
  }
}

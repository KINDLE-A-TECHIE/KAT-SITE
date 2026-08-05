import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { generatePresignedDownloadUrl } from "@/lib/r2";
import { isOwnScratchAnswerKey } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived presigned GET URL so the editor can reload the pupil's saved answer. The key comes
 * from the request but is only signed after proving it belongs to THIS pupil (isOwnScratchAnswerKey), so it
 * can never be used to read another pupil's work.
 */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid payload.", 400);
  }
  const key = (body as { key?: unknown })?.key;
  if (!isOwnScratchAnswerKey(key, session.user.id)) return fail("Not found.", 404);

  try {
    const projectUrl = await generatePresignedDownloadUrl(key);
    return ok({ projectUrl });
  } catch (error) {
    captureError(error);
    return fail("Could not open the project. Please try again.", 500);
  }
}

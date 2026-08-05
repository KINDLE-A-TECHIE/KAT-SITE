import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { scratchAnswerKey, SCRATCH_SB3_CONTENT_TYPE } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * Mint a presigned PUT URL for the current pupil to save their Scratch ANSWER to a SCRATCH question. The
 * editor iframe PUTs the .sb3 straight to R2; the bytes never touch the server. The key is minted under the
 * pupil's own namespace (scratch-answers/<userId>/<questionId>/...), so a pupil can only write their own.
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
  const questionId = (body as { questionId?: unknown })?.questionId;
  if (typeof questionId !== "string" || !questionId) return fail("Invalid payload.", 400);

  const question = await prisma.assessmentQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, type: true },
  });
  if (!question || question.type !== "SCRATCH") return fail("Not found.", 404);

  try {
    const key = scratchAnswerKey(session.user.id, questionId);
    // The signed content-type MUST match what the editor bridge PUTs, or the signature is rejected.
    const uploadUrl = await generatePresignedUploadUrl(key, SCRATCH_SB3_CONTENT_TYPE);
    return ok({ uploadUrl, key });
  } catch (error) {
    captureError(error);
    return fail("Could not prepare the save. Please try again.", 500);
  }
}

import { CourseAudience, QuestionType } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveEmbedPupil } from "@/lib/school-embed-pupil";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { scratchAnswerKey, SCRATCH_SB3_CONTENT_TYPE } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * Mint a presigned PUT so a pupil can save their Scratch ANSWER to a SCRATCH assessment question, from
 * INSIDE the embed. The key is minted under the pupil's own namespace, so it can only ever be their own
 * answer; the submit + grading paths re-verify ownership and the assessment context, so this is safe even
 * though it does not re-check the schedule here. The question must be a SCRATCH question on a SCHOOL
 * assessment, so a school pupil's frame can never touch a B2C question.
 */
export async function POST(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const body = (await request.json().catch(() => null)) as { questionId?: unknown } | null;
  const questionId = body?.questionId;
  if (typeof questionId !== "string" || !questionId) return fail("Invalid payload.", 400);

  const question = await prisma.assessmentQuestion.findFirst({
    where: {
      id: questionId,
      type: QuestionType.SCRATCH,
      assessment: { program: { audience: CourseAudience.SCHOOL } },
    },
    select: { id: true },
  });
  if (!question) return fail("Not found.", 404);

  try {
    const key = scratchAnswerKey(auth.pupil.userId, questionId);
    const uploadUrl = await generatePresignedUploadUrl(key, SCRATCH_SB3_CONTENT_TYPE);
    return ok({ uploadUrl, key });
  } catch (error) {
    captureError(error);
    return fail("Could not prepare the save. Please try again.", 500);
  }
}

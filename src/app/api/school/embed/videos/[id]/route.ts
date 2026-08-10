import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveEmbedPupil } from "@/lib/school-embed-pupil";
import { deleteR2Object } from "@/lib/r2";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ id: string }> }

/**
 * Delete one of the pupil's own recordings, from INSIDE the embed. Ownership enforced by scoping the
 * lookup to the session userId; hard-deletes the R2 object then the row (the pupil's own artifact).
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const { id } = await params;
  try {
    const recording = await prisma.stageRecording.findFirst({
      where: { id, userId: auth.pupil.userId },
      select: { id: true, r2Key: true },
    });
    if (!recording) return fail("Not found.", 404);

    await deleteR2Object(recording.r2Key);
    await prisma.stageRecording.delete({ where: { id: recording.id } });
    return ok({ deleted: true });
  } catch (error) {
    captureError(error);
    return fail("Could not delete the recording.", 500);
  }
}

import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object } from "@/lib/r2";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ id: string }> }

/**
 * Delete one of the current user's recordings. A stage recording is the user's OWN artifact (not a roster
 * record or an audit trail), so a hard delete of both the R2 object and the row is correct: the user asked
 * to remove their own file. Ownership is enforced by scoping the delete to session.user.id.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id } = await params;

  try {
    const recording = await prisma.stageRecording.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, r2Key: true },
    });
    if (!recording) return fail("Not found.", 404);

    // Remove the bytes first; if that fails we keep the row so the object is never orphaned silently.
    await deleteR2Object(recording.r2Key);
    await prisma.stageRecording.delete({ where: { id: recording.id } });
    return ok({ deleted: true });
  } catch (error) {
    captureError(error);
    return fail("Could not delete the recording.", 500);
  }
}

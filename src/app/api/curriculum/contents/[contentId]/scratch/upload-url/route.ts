import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePresignedUploadUrl } from "@/lib/r2";
import { scratchProjectKey, SCRATCH_SB3_CONTENT_TYPE } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

interface Params {
  params: Promise<{ contentId: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Mint a presigned PUT URL for the current user to save their Scratch project for this content block. The
 * editor iframe PUTs the .sb3 straight to R2 with this URL; the bytes never touch the server. The key is
 * server-minted under the user's own namespace (scratch-storage.ts), so a pupil can only write their own.
 */
export async function POST(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { contentId } = await params;
  const content = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { id: true, type: true },
  });
  if (!content || content.type !== "SCRATCH") return fail("Not found.", 404);

  try {
    const key = scratchProjectKey(session.user.id, contentId);
    // The signed content-type MUST match what the editor bridge PUTs, or the signature is rejected.
    const uploadUrl = await generatePresignedUploadUrl(key, SCRATCH_SB3_CONTENT_TYPE);
    return ok({ uploadUrl, key });
  } catch (error) {
    captureError(error);
    return fail("Could not prepare the save. Please try again.", 500);
  }
}

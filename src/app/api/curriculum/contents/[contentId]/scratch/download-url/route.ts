import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePresignedDownloadUrl } from "@/lib/r2";
import { isOwnScratchKey } from "@/lib/scratch-storage";
import { captureError } from "@/lib/sentry";

interface Params {
  params: Promise<{ contentId: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived presigned GET URL so the editor can load the user's saved project. The key comes from
 * the request but is only signed after proving it belongs to THIS user (isOwnScratchKey), so it can never
 * be used to read another pupil's work. A child's project is never served from the public R2 URL.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { contentId } = await params;
  const content = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { id: true, type: true },
  });
  if (!content || content.type !== "SCRATCH") return fail("Not found.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid payload.", 400);
  }
  const key = (body as { key?: unknown })?.key;
  if (!isOwnScratchKey(key, session.user.id)) return fail("Not found.", 404);

  try {
    const projectUrl = await generatePresignedDownloadUrl(key);
    return ok({ projectUrl });
  } catch (error) {
    captureError(error);
    return fail("Could not open the project. Please try again.", 500);
  }
}

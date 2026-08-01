import { randomUUID } from "crypto";
import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALLOWED_IMAGE_TYPES, compressImageToWebp } from "@/lib/image";
import { r2PublicUrl, uploadToR2 } from "@/lib/r2";
import { contentUploadLimiter, rateLimitResponse } from "@/lib/ratelimit";
import { captureError } from "@/lib/sentry";

interface Params { params: Promise<{ lessonId: string }> }

// Same authoring roles as POST /contents: only content creators may attach an image to a note.
const CREATOR_ROLES = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR];

export const dynamic = "force-dynamic";
export const maxDuration = 30; // sharp compression can be slow on a cold host

const MAX_INPUT_SIZE = 20 * 1024 * 1024; // 20 MB raw; a bigger picture is accepted and shrunk, not rejected
const TARGET_SIZE = 1.5 * 1024 * 1024;   // stored note image stays small
// Larger than a logo's cap (1024): a note image is often a labelled diagram a pupil needs to zoom into.
const MAX_DIMENSION = 1600;

/**
 * Upload an image for a lesson note. The client sends the RAW file; sharp compresses it to WebP
 * server-side (like the avatar/logo path in src/lib/image.ts) so a big photo is stored small with EXIF
 * stripped, rather than the browser PUTting the raw bytes straight to R2. We store only the R2 key's
 * public URL, which the author drops into the note body as an <img>.
 */
export async function POST(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!(CREATOR_ROLES as UserRole[]).includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const { lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
  if (!lesson) return fail("Lesson not found.", 404);

  if (contentUploadLimiter) {
    const { success, reset } = await contentUploadLimiter.limit(session.user.id);
    if (!success) return rateLimitResponse(reset);
  }

  try {
    const mimeType = (request.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) return fail("Use a JPEG, PNG, WebP, or GIF image.", 400);

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_INPUT_SIZE) return fail("Image too large (max 20 MB before compression).", 400);

    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.byteLength > MAX_INPUT_SIZE) return fail("Image too large (max 20 MB before compression).", 400);
    if (raw.byteLength === 0) return fail("Empty file received.", 400);

    const compressed = await compressImageToWebp(raw, { maxDimension: MAX_DIMENSION, targetBytes: TARGET_SIZE });
    const key = `lessons/${lessonId}/note-images/${randomUUID()}.webp`;
    await uploadToR2(key, compressed, "image/webp");

    return ok({ url: r2PublicUrl(key) });
  } catch (error) {
    captureError(error);
    return fail("Could not process the image. Please try a different one.", 500);
  }
}

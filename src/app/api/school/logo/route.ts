import { randomUUID } from "crypto";
import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { ALLOWED_IMAGE_TYPES, compressImageToWebp } from "@/lib/image";
import { deleteR2Object, r2PublicUrl, uploadToR2 } from "@/lib/r2";
import { captureError } from "@/lib/sentry";

/**
 * The school's logo (its "profile picture"). SCHOOL_ADMIN only.
 *
 * The client sends the raw image; sharp compresses it to WebP under the 5 MB ceiling server-side, so
 * a bigger picture is accepted and shrunk rather than rejected. We store only the R2 KEY on School and
 * build the URL at read time (r2PublicUrl), per the storage rule. TENANT ISOLATION: schoolId comes
 * from the session (requireActiveSchool); the School row is its own tenant (School.id === schoolId).
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30; // compression can be slow on a cold host
export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

const MAX_INPUT_SIZE = 20 * 1024 * 1024; // 20 MB raw input; anything up to this compresses down
const TARGET_SIZE = 4.5 * 1024 * 1024;  // stored logo stays comfortably under the 5 MB max
const MAX_DIMENSION = 1024;             // a logo never needs more; keeps the stored file tiny

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

export async function GET() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { logoKey: true } });
  return ok({ logoUrl: school?.logoKey ? r2PublicUrl(school.logoKey) : null });
}

export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  try {
    const mimeType = (request.headers.get("content-type") ?? "").split(";")[0]!.trim();
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      return fail("Only JPEG, PNG, WebP, or GIF images are allowed.", 400);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_INPUT_SIZE) return fail("File too large (max 20 MB before compression).", 400);

    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.byteLength > MAX_INPUT_SIZE) return fail("File too large (max 20 MB before compression).", 400);
    if (raw.byteLength === 0) return fail("Empty file received.", 400);

    const compressed = await compressImageToWebp(raw, { maxDimension: MAX_DIMENSION, targetBytes: TARGET_SIZE });
    const key = `school-logos/${schoolId}/${randomUUID()}.webp`;

    const existing = await prisma.school.findUnique({ where: { id: schoolId }, select: { logoKey: true } });

    await uploadToR2(key, compressed, "image/webp");
    await prisma.school.update({ where: { id: schoolId }, data: { logoKey: key } });

    // Best-effort cleanup of the previous logo.
    if (existing?.logoKey) await deleteR2Object(existing.logoKey).catch(() => undefined);

    return ok({ logoUrl: r2PublicUrl(key) });
  } catch (error) {
    captureError(error);
    return fail("Could not process the logo. Please try a different image.", 500);
  }
}

export async function DELETE() {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  const existing = await prisma.school.findUnique({ where: { id: schoolId }, select: { logoKey: true } });
  if (existing?.logoKey) await deleteR2Object(existing.logoKey).catch(() => undefined);
  await prisma.school.update({ where: { id: schoolId }, data: { logoKey: null } });

  return ok({ logoUrl: null });
}

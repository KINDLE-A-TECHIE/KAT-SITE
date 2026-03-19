import { randomUUID } from "crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteR2Object, r2KeyFromUrl, r2PublicUrl, uploadToR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30; // allow time for compression on slow hosts

// Allow up to 20 MB raw input (sharp will compress it down)
export const config = { api: { bodyParser: { sizeLimit: "20mb" } } };

/**
 * Compress an image to WebP using sharp.
 * - Strips EXIF metadata
 * - Caps longest dimension at MAX_DIMENSION
 * - Tries lossless first; if output exceeds TARGET_SIZE, steps down quality
 *   in increments until it fits (minimum quality 60)
 */
async function compressImage(input: Buffer): Promise<Buffer> {
  const pipeline = sharp(input, { failOn: "truncated" })
    .rotate()                      // auto-orient from EXIF before stripping
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
    .withMetadata({ exif: {} });   // strip all EXIF except orientation

  // Try lossless WebP first (best quality, larger file)
  const lossless = await pipeline.clone().webp({ lossless: true }).toBuffer();
  if (lossless.byteLength <= TARGET_SIZE) return lossless;

  // Step down quality until it fits — 85 → 75 → 65 → 60
  for (const quality of [85, 75, 65, 60]) {
    const attempt = await pipeline.clone().webp({ quality, effort: 6 }).toBuffer();
    if (attempt.byteLength <= TARGET_SIZE) return attempt;
  }

  // Last resort — quality 60 regardless of size (still well under 5 MB for any sane photo)
  return pipeline.clone().webp({ quality: 60, effort: 6 }).toBuffer();
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_INPUT_SIZE = 20 * 1024 * 1024; // 20 MB raw input limit
const TARGET_SIZE = 4.5 * 1024 * 1024;  // target <4.5 MB output
const MAX_DIMENSION = 1920;              // cap longest side at 1920px

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { avatarUrl: true },
  });

  return NextResponse.json(
    { avatarUrl: profile?.avatarUrl ?? null },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
        Expires: "0",
        Vary: "Cookie",
      },
    },
  );
}

/** Upload avatar — receives raw file bytes, stores in R2, saves URL to DB. */
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  try {
    const contentType = request.headers.get("content-type") ?? "";
    // Strip any parameters like "; charset=utf-8"
    const mimeType = contentType.split(";")[0]!.trim();
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return fail("Only JPEG, PNG, WebP, or GIF images are allowed.", 400);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_INPUT_SIZE) return fail("File too large (max 20 MB).", 400);

    const raw = Buffer.from(await request.arrayBuffer());
    if (raw.byteLength > MAX_INPUT_SIZE) return fail("File too large (max 20 MB).", 400);
    if (raw.byteLength === 0) return fail("Empty file received.", 400);

    // Compress with sharp — strip EXIF, resize if needed, encode as WebP
    const compressed = await compressImage(raw);

    const key = `avatars/${session.user.id}/${randomUUID()}.webp`;

    // Fetch old avatar for cleanup
    const existing = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { avatarUrl: true },
    });

    // Upload to R2
    await uploadToR2(key, compressed, "image/webp");

    const avatarUrl = r2PublicUrl(key);

    // Save to DB
    await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, avatarUrl },
      update: { avatarUrl },
    });

    // Delete old R2 object (best-effort)
    if (existing?.avatarUrl) {
      const oldKey = r2KeyFromUrl(existing.avatarUrl);
      if (oldKey) await deleteR2Object(oldKey).catch(() => undefined);
    }

    return ok({ avatarUrl });
  } catch (err) {
    console.error("[avatar POST]", err);
    return fail("Could not process image. Please try a different file.", 500);
  }
}

/** Remove avatar — clears DB and deletes R2 object. */
export async function DELETE() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const existing = await prisma.profile.findUnique({
    where: { userId: session.user.id },
    select: { avatarUrl: true },
  });

  if (existing?.avatarUrl) {
    const key = r2KeyFromUrl(existing.avatarUrl);
    if (key) await deleteR2Object(key).catch(() => undefined);
  }

  await prisma.profile.update({
    where: { userId: session.user.id },
    data: { avatarUrl: null },
  });

  return ok({ avatarUrl: null });
}

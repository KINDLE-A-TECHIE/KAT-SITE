import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveEmbedPupil } from "@/lib/school-embed-pupil";
import { generatePresignedDownloadUrl } from "@/lib/r2";
import { isOwnStageVideoKey, MAX_STAGE_VIDEO_BYTES } from "@/lib/video-storage";
import { captureError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * A pupil's saved stage recordings, from INSIDE the embed. Mirrors /api/videos but authed by the embed
 * session. Strictly per-pupil: every query is scoped to the session userId, played via a short-lived
 * presigned GET (never the public R2 URL).
 */

// ── List (optionally just the clips tied to one content). ──
export async function GET(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: false });
  if (!auth.ok) return fail(auth.error, auth.status);

  const contentId = new URL(request.url).searchParams.get("contentId");
  try {
    const rows = await prisma.stageRecording.findMany({
      where: { userId: auth.pupil.userId, ...(contentId ? { contentId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, r2Key: true, contentId: true, title: true, sizeBytes: true, durationMs: true, createdAt: true },
    });
    const recordings = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        contentId: r.contentId,
        title: r.title,
        sizeBytes: r.sizeBytes,
        durationMs: r.durationMs,
        createdAt: r.createdAt,
        url: await generatePresignedDownloadUrl(r.r2Key),
      })),
    );
    return ok({ recordings });
  } catch (error) {
    captureError(error);
    return fail("Could not load your recordings.", 500);
  }
}

const confirmSchema = z.object({
  key: z.string().min(1).max(300),
  contentId: z.string().max(64).nullish(),
  title: z.string().trim().max(120).nullish(),
  sizeBytes: z.number().int().positive().max(MAX_STAGE_VIDEO_BYTES),
  durationMs: z.number().int().positive().max(6 * 60 * 60 * 1000).nullish(),
});

// ── Confirm an upload: create the row AFTER the recorder has PUT the .webm to R2. ──
export async function POST(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  // Never trust a key from the client for authz: it must be one of THIS pupil's own keys.
  if (!isOwnStageVideoKey(parsed.data.key, auth.pupil.userId)) return fail("Forbidden", 403);

  try {
    const recording = await prisma.stageRecording.create({
      data: {
        userId: auth.pupil.userId,
        r2Key: parsed.data.key,
        contentId: parsed.data.contentId ?? null,
        title: parsed.data.title?.trim() || null,
        sizeBytes: parsed.data.sizeBytes,
        durationMs: parsed.data.durationMs ?? null,
      },
      select: { id: true, contentId: true, title: true, sizeBytes: true, durationMs: true, createdAt: true },
    });
    return ok({ recording }, 201);
  } catch (error) {
    captureError(error);
    return fail("Could not save the recording.", 500);
  }
}

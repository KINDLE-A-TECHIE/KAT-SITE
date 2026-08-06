import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveEmbedPupil, assertContentOnPupilProgramme } from "@/lib/school-embed-pupil";

export const dynamic = "force-dynamic";

interface Params { params: Promise<{ contentId: string }> }

const MAX_STATE_BYTES = 256 * 1024;
const schema = z.object({ state: z.unknown() });

/**
 * A pupil's per-block working state, from INSIDE the embed. Same LessonBlockDraft row the in-app path uses
 * (keyed by userId + contentId), so a draft started in the frame follows the pupil to the hosted app and
 * back. Identity is the embed session; the content must be on the pupil's own licensed programme.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await resolveEmbedPupil(request, { mutation: false });
  if (!auth.ok) return fail(auth.error, auth.status);

  const { contentId } = await params;
  const found = await assertContentOnPupilProgramme(contentId, auth.pupil.enrollment);
  if (!found.ok) return fail(found.error, found.status);

  const draft = await prisma.lessonBlockDraft.findUnique({
    where: { userId_contentId: { userId: auth.pupil.userId, contentId } },
    select: { state: true, updatedAt: true },
  });
  return ok({ state: draft?.state ?? null, updatedAt: draft?.updatedAt ?? null });
}

export async function PUT(request: Request, { params }: Params) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const { contentId } = await params;
  const found = await assertContentOnPupilProgramme(contentId, auth.pupil.enrollment);
  if (!found.ok) return fail(found.error, found.status);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());
  const { state } = parsed.data;
  if (state === undefined || state === null) return fail("A non-null state is required.", 400);
  if (JSON.stringify(state).length > MAX_STATE_BYTES) return fail("Draft is too large.", 413);

  const value = state as Prisma.InputJsonValue;
  const draft = await prisma.lessonBlockDraft.upsert({
    where: { userId_contentId: { userId: auth.pupil.userId, contentId } },
    create: { userId: auth.pupil.userId, contentId, state: value },
    update: { state: value },
    select: { updatedAt: true },
  });
  return ok({ updatedAt: draft.updatedAt });
}

export async function DELETE(request: Request, { params }: Params) {
  const auth = await resolveEmbedPupil(request, { mutation: true });
  if (!auth.ok) return fail(auth.error, auth.status);

  const { contentId } = await params;
  // Idempotent, and userId-scoped so a pupil can only clear their own draft.
  await prisma.lessonBlockDraft.deleteMany({ where: { userId: auth.pupil.userId, contentId } });
  return ok({ deleted: true });
}

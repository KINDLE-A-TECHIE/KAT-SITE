import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ contentId: string }> }

// Generous for code plus a handful of small files, while guarding against a runaway payload.
const MAX_STATE_BYTES = 256 * 1024;

const schema = z.object({ state: z.unknown() });

/**
 * Per-learner working state for one interactive lesson block (code-playground code, network-lab setup,
 * etc.), so a draft follows the user across devices instead of living in one browser's localStorage.
 *
 * The row is ALWAYS keyed to the session user; contentId comes from the URL but the userId never comes
 * from the request, so one user can only ever read or write their own draft.
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { contentId } = await params;
  const draft = await prisma.lessonBlockDraft.findUnique({
    where: { userId_contentId: { userId: session.user.id, contentId } },
    select: { state: true, updatedAt: true },
  });

  return ok({ state: draft?.state ?? null, updatedAt: draft?.updatedAt ?? null });
}

export async function PUT(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { contentId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid payload.", 400, parsed.error.flatten());

  const { state } = parsed.data;
  if (state === undefined || state === null) return fail("A non-null state is required.", 400);
  if (JSON.stringify(state).length > MAX_STATE_BYTES) return fail("Draft is too large.", 413);

  // The content must exist so we never accumulate drafts for a bogus id.
  const content = await prisma.lessonContent.findUnique({ where: { id: contentId }, select: { id: true } });
  if (!content) return fail("Content not found.", 404);

  const userId = session.user.id;
  const value = state as Prisma.InputJsonValue;
  const draft = await prisma.lessonBlockDraft.upsert({
    where: { userId_contentId: { userId, contentId } },
    create: { userId, contentId, state: value },
    update: { state: value },
    select: { updatedAt: true },
  });

  return ok({ updatedAt: draft.updatedAt });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { contentId } = await params;
  // deleteMany keeps it idempotent: clearing a draft that is not there is still a success.
  await prisma.lessonBlockDraft.deleteMany({ where: { userId: session.user.id, contentId } });

  return ok({ deleted: true });
}

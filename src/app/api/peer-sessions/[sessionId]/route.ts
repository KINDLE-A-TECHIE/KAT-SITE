import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface Params { params: Promise<{ sessionId: string }> }

const participantSelect = {
  userId: true,
  joinedAt: true,
  lastSeenAt: true,
  user: { select: { id: true, firstName: true, lastName: true } },
};

// PATCH /api/peer-sessions/[sessionId], push updated code from a participant
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { sessionId } = await params;

  let body: unknown;
  try { body = await request.json(); } catch { return fail("Invalid JSON", 400); }
  const { code } = body as { code?: string };
  if (typeof code !== "string") return fail("code is required.", 400);

  // Verify session is active and caller is a participant
  const peerSession = await prisma.peerSession.findUnique({
    where: { id: sessionId },
    select: { status: true, participants: { select: { userId: true } } },
  });
  if (!peerSession) return fail("Session not found.", 404);
  if (peerSession.status !== "ACTIVE") return fail("Session is not active.", 400);

  const isParticipant = peerSession.participants.some((p) => p.userId === session.user.id);
  if (!isParticipant) return fail("You are not in this session.", 403);

  await prisma.$transaction([
    prisma.peerSession.update({
      where: { id: sessionId },
      data: { currentCode: code },
    }),
    prisma.peerSessionParticipant.update({
      where: { sessionId_userId: { sessionId, userId: session.user.id } },
      data: { lastSeenAt: new Date() },
    }),
  ]);

  return ok({ ok: true });
}

// DELETE /api/peer-sessions/[sessionId], end the session (host or admin+)
export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { sessionId } = await params;

  const peerSession = await prisma.peerSession.findUnique({
    where: { id: sessionId },
    select: { hostId: true, status: true },
  });
  if (!peerSession) return fail("Session not found.", 404);

  const role = session.user.role as UserRole;
  const canEnd =
    peerSession.hostId === session.user.id ||
    role === UserRole.ADMIN ||
    role === UserRole.SUPER_ADMIN;
  if (!canEnd) return fail("Forbidden", 403);

  await prisma.peerSession.update({
    where: { id: sessionId },
    data: { status: "ENDED" },
  });

  // Also return participants so client can show final state
  const updated = await prisma.peerSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, participants: { select: participantSelect } },
  });

  return ok({ session: updated });
}

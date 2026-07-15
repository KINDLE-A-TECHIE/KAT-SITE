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

// POST /api/peer-sessions/[sessionId]/join, join an active peer session
export async function POST(_request: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { sessionId } = await params;

  const peerSession = await prisma.peerSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, currentCode: true },
  });
  if (!peerSession) return fail("Session not found.", 404);
  if (peerSession.status !== "ACTIVE") return fail("Session is no longer active.", 400);

  // Upsert participant (idempotent, rejoining is fine)
  await prisma.peerSessionParticipant.upsert({
    where: { sessionId_userId: { sessionId, userId: session.user.id } },
    create: { sessionId, userId: session.user.id },
    update: { lastSeenAt: new Date() },
  });

  const updated = await prisma.peerSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      currentCode: true,
      hostId: true,
      status: true,
      participants: { select: participantSelect },
    },
  });

  return ok({ session: updated });
}

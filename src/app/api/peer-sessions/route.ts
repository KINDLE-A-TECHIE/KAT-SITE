import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const HOST_ROLES: UserRole[] = [UserRole.INSTRUCTOR, UserRole.ADMIN, UserRole.SUPER_ADMIN];

const participantSelect = {
  userId: true,
  joinedAt: true,
  lastSeenAt: true,
  user: { select: { id: true, firstName: true, lastName: true } },
};

// GET /api/peer-sessions?contentId=xxx — fetch active session for a content block
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const contentId = new URL(request.url).searchParams.get("contentId");
  if (!contentId) return fail("contentId is required.", 400);

  const peerSession = await prisma.peerSession.findFirst({
    where: { contentId, status: "ACTIVE" },
    select: {
      id: true,
      currentCode: true,
      hostId: true,
      status: true,
      updatedAt: true,
      participants: { select: participantSelect },
    },
  });

  return ok({ session: peerSession });
}

// POST /api/peer-sessions — start a new peer session (instructor/admin only)
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!HOST_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return fail("Invalid JSON", 400); }
  const { contentId, starterCode } = body as { contentId?: string; starterCode?: string };
  if (!contentId) return fail("contentId is required.", 400);

  // Verify content exists and is a CODE_PLAYGROUND
  const content = await prisma.lessonContent.findUnique({
    where: { id: contentId },
    select: { id: true, type: true },
  });
  if (!content) return fail("Content not found.", 404);
  if (content.type !== "CODE_PLAYGROUND") return fail("Peer sessions are only available for code playgrounds.", 400);

  // End any existing active sessions for this content
  await prisma.peerSession.updateMany({
    where: { contentId, status: "ACTIVE" },
    data: { status: "ENDED" },
  });

  const peerSession = await prisma.peerSession.create({
    data: {
      contentId,
      hostId: session.user.id,
      currentCode: starterCode ?? "",
      participants: {
        create: { userId: session.user.id },
      },
    },
    select: {
      id: true,
      currentCode: true,
      hostId: true,
      status: true,
      participants: { select: participantSelect },
    },
  });

  return ok({ session: peerSession }, 201);
}

import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildJitsiJoinUrl, isJitsiConfigured } from "@/lib/jitsi";
import { UserRole } from "@prisma/client";

interface Params { params: Promise<{ meetingId: string }> }

const HOST_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.FELLOW];

/**
 * GET /api/meetings/[meetingId]/join
 *
 * Returns a short-lived signed Jitsi join URL for the requesting user.
 * The JWT is valid for 4 hours and grants moderator privileges to host-role users.
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!isJitsiConfigured()) return fail("Meetings are not configured on this server.", 503);

  const { meetingId } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      roomName: true,
      hostId: true,
      participants: { select: { userId: true } },
    },
  });
  if (!meeting) return fail("Meeting not found.", 404);

  const isParticipant = meeting.participants.some((p) => p.userId === session.user.id);
  if (!isParticipant) return fail("You are not a participant in this meeting.", 403);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      profile: { select: { avatarUrl: true } },
    },
  });
  if (!user) return fail("User not found.", 404);

  // Hosts and staff get moderator rights; students/fellows do not
  const isModerator = meeting.hostId === session.user.id || HOST_ROLES.includes(user.role);

  const joinUrl = buildJitsiJoinUrl(meeting.roomName, {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`,
    email: user.email,
    avatarUrl: user.profile?.avatarUrl,
    isModerator,
  });

  return ok({ joinUrl });
}

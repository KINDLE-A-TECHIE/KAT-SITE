import { MeetingRecordingMode, MeetingRecordingStatus, MeetingStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMeetingSchema } from "@/lib/validators";
import { buildJitsiBaseUrl, generateRoomName, getMeetingStatus, isJitsiConfigured } from "@/lib/jitsi";
import { trackEvent } from "@/lib/analytics";

const HOST_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.FELLOW];
const RECORDING_VIEW_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

function defaultRecordingStatus(mode: MeetingRecordingMode) {
  return mode === MeetingRecordingMode.AUTO_REQUIRED
    ? MeetingRecordingStatus.PENDING
    : MeetingRecordingStatus.NOT_REQUESTED;
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as MeetingStatus | null;
  const scope = url.searchParams.get("scope");
  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;
  const canLoadOrgRecordings = scope === "recordings" && isSuperAdmin && Boolean(session.user.organizationId);
  const canViewRecordings = RECORDING_VIEW_ROLES.includes(session.user.role);

  const meetings = await prisma.meeting.findMany({
    where: canLoadOrgRecordings
      ? {
          organizationId: session.user.organizationId ?? undefined,
          status: MeetingStatus.ENDED,
          recordingMode: { not: MeetingRecordingMode.NONE },
        }
      : {
          participants: { some: { userId: session.user.id } },
          status: status ?? undefined,
        },
    orderBy: { startTime: canLoadOrgRecordings ? "desc" : "asc" },
    include: {
      host: { select: { id: true, firstName: true, lastName: true, role: true } },
      participants: {
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
      cohort: { select: { id: true, name: true } },
    },
  });

  // Sync time-based status changes
  const synced = await Promise.all(
    meetings.map(async (meeting) => {
      const derivedStatus = getMeetingStatus(meeting.startTime, meeting.endTime);
      const nextStatus = meeting.status === MeetingStatus.CANCELLED ? MeetingStatus.CANCELLED : derivedStatus;

      if (meeting.status !== derivedStatus && meeting.status !== MeetingStatus.CANCELLED) {
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: { status: derivedStatus },
        });
      }

      return { ...meeting, status: nextStatus };
    }),
  );

  const result = canViewRecordings
    ? synced
    : synced.map((m) => ({ ...m, recordingPlayUrl: null, recordingDownloadUrl: null }));

  return ok({ meetings: result, scope: canLoadOrgRecordings ? "recordings" : "participant" });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!HOST_ROLES.includes(session.user.role)) return fail("Forbidden", 403);
  if (!isJitsiConfigured()) return fail("Meetings are not configured on this server.", 503);

  const body = await request.json() as unknown;
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) return fail("Invalid meeting payload.", 400, parsed.error.flatten());

  const startTime = new Date(parsed.data.startTime);
  const endTime = new Date(parsed.data.endTime);
  if (endTime <= startTime) return fail("End time must be after start time.", 400);

  const participants = [...new Set([session.user.id, ...parsed.data.participantIds])];
  const participantUsers = await prisma.user.findMany({
    where: { id: { in: participants } },
    select: { id: true, role: true },
  });
  if (participantUsers.length !== participants.length) {
    return fail("One or more selected participants were not found.", 400);
  }

  const roomName = generateRoomName();
  const roomUrl = buildJitsiBaseUrl(roomName);
  const status = getMeetingStatus(startTime, endTime);

  const meeting = await prisma.meeting.create({
    data: {
      organizationId: session.user.organizationId ?? undefined,
      cohortId: parsed.data.cohortId,
      hostId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      startTime,
      endTime,
      roomName,
      roomUrl,
      status,
      recordingMode: MeetingRecordingMode.NONE,
      recordingStatus: MeetingRecordingStatus.NOT_REQUESTED,
      participants: {
        createMany: {
          data: participants.map((participantId) => ({
            userId: participantId,
            isHost: participantId === session.user.id,
          })),
        },
      },
    },
    include: {
      host: { select: { id: true, firstName: true, lastName: true, role: true } },
      participants: {
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
    },
  });

  await trackEvent({
    userId: session.user.id,
    organizationId: session.user.organizationId,
    eventType: "meeting",
    eventName: "meeting_created",
    payload: { meetingId: meeting.id },
  });

  return ok({ meeting }, 201);
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!HOST_ROLES.includes(session.user.role)) return fail("Forbidden", 403);

  const body = (await request.json()) as {
    meetingId?: string;
    participantIds?: string[];
    status?: MeetingStatus;
    recordingMode?: MeetingRecordingMode;
  };
  if (!body.meetingId) return fail("meetingId is required.", 400);

  const meeting = await prisma.meeting.findUnique({
    where: { id: body.meetingId },
    select: { id: true, hostId: true, status: true, recordingMode: true, recordingStatus: true },
  });
  if (!meeting) return fail("Meeting not found.", 404);

  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;
  const isAdminOrInstructor = session.user.role === UserRole.ADMIN || session.user.role === UserRole.INSTRUCTOR;
  const isHost = meeting.hostId === session.user.id;
  const isCancelRequest = body.status === MeetingStatus.CANCELLED;

  if (isCancelRequest && !(isSuperAdmin || (isHost && isAdminOrInstructor))) return fail("Forbidden", 403);
  if (body.status && !isCancelRequest && !(isSuperAdmin || isHost)) return fail("Forbidden", 403);
  if (body.participantIds && !(isSuperAdmin || isHost)) return fail("Forbidden", 403);
  if (body.recordingMode !== undefined && !isSuperAdmin) return fail("Only super admins can override recording mode.", 403);

  const VALID_RECORDING_MODES = Object.values(MeetingRecordingMode);
  if (body.recordingMode !== undefined && !VALID_RECORDING_MODES.includes(body.recordingMode)) {
    return fail("Invalid recording mode.", 400);
  }

  const updateData: {
    status?: MeetingStatus;
    recordingMode?: MeetingRecordingMode;
    recordingStatus?: MeetingRecordingStatus;
  } = {};

  if (body.status) updateData.status = body.status;

  if (body.recordingMode !== undefined) {
    updateData.recordingMode = body.recordingMode;
    // Only reset recording status if a recording isn't already available
    if (meeting.recordingStatus !== MeetingRecordingStatus.AVAILABLE) {
      updateData.recordingStatus = defaultRecordingStatus(body.recordingMode);
    }
  }

  if (body.participantIds) {
    const participants = [...new Set([meeting.hostId, ...body.participantIds])];
    const participantUsers = await prisma.user.findMany({
      where: { id: { in: participants } },
      select: { id: true },
    });
    if (participantUsers.length !== participants.length) {
      return fail("One or more selected participants were not found.", 400);
    }

    await prisma.$transaction([
      prisma.meetingParticipant.deleteMany({ where: { meetingId: meeting.id } }),
      prisma.meetingParticipant.createMany({
        data: participants.map((participantId) => ({
          meetingId: meeting.id,
          userId: participantId,
          isHost: participantId === meeting.hostId,
        })),
      }),
    ]);
  }

  const updated =
    Object.keys(updateData).length > 0
      ? await prisma.meeting.update({
          where: { id: meeting.id },
          data: updateData,
          include: {
            host: { select: { id: true, firstName: true, lastName: true, role: true } },
            participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
          },
        })
      : await prisma.meeting.findUnique({
          where: { id: meeting.id },
          include: {
            host: { select: { id: true, firstName: true, lastName: true, role: true } },
            participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
          },
        });

  if (!updated) return fail("Meeting not found.", 404);
  return ok({ meeting: updated });
}

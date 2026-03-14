import { MeetingRecordingMode, MeetingRecordingStatus, MeetingStatus, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMeetingSchema } from "@/lib/validators";
import {
  buildZohoMeetingJoinUrl,
  createZohoMeetingSession,
  getMeetingStatus,
  syncZohoMeetingRecording,
} from "@/lib/zoho-meeting";
import { trackEvent } from "@/lib/analytics";

const HOST_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.FELLOW];
const AUTO_RECORD_ROLES: UserRole[] = [UserRole.STUDENT, UserRole.FELLOW];
const RECORDING_FAILURE_GRACE_MS = 60 * 60 * 1000;
const RECORDING_VIEW_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

function resolveRecordingMode(participantRoles: UserRole[]) {
  const requiresAutoRecording = participantRoles.some((role) => AUTO_RECORD_ROLES.includes(role));
  return requiresAutoRecording ? MeetingRecordingMode.AUTO_REQUIRED : MeetingRecordingMode.MANUAL;
}

function defaultRecordingStatus(mode: MeetingRecordingMode) {
  return mode === MeetingRecordingMode.AUTO_REQUIRED
    ? MeetingRecordingStatus.PENDING
    : MeetingRecordingStatus.NOT_REQUESTED;
}

function shouldMarkRecordingAsFailed(endTime: Date) {
  return Date.now() - endTime.getTime() >= RECORDING_FAILURE_GRACE_MS;
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as MeetingStatus | null;
  const scope = url.searchParams.get("scope");
  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;
  const canSyncRecordings = isSuperAdmin;
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
          participants: {
            some: { userId: session.user.id },
          },
          status: status ?? undefined,
        },
    orderBy: { startTime: canLoadOrgRecordings ? "desc" : "asc" },
    include: {
      host: { select: { id: true, firstName: true, lastName: true, role: true } },
      participants: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      },
      cohort: {
        select: { id: true, name: true },
      },
    },
  });

  const nowStatusSynced = await Promise.all(
    meetings.map(async (meeting) => {
      const derivedStatus = getMeetingStatus(meeting.startTime, meeting.endTime);
      const nextStatus = meeting.status === MeetingStatus.CANCELLED ? MeetingStatus.CANCELLED : derivedStatus;
      const updateData: {
        status?: MeetingStatus;
        recordingStatus?: MeetingRecordingStatus;
        recordingPlayUrl?: string | null;
        recordingDownloadUrl?: string | null;
        recordingExternalId?: string | null;
        recordingSyncedAt?: Date;
      } = {};

      if (meeting.status !== derivedStatus && meeting.status !== MeetingStatus.CANCELLED) {
        updateData.status = derivedStatus;
      }

      if (
        canSyncRecordings &&
        meeting.recordingMode === MeetingRecordingMode.AUTO_REQUIRED &&
        nextStatus === MeetingStatus.ENDED &&
        meeting.recordingStatus !== MeetingRecordingStatus.AVAILABLE
      ) {
        try {
          const syncResult = await syncZohoMeetingRecording({
            meetingKey: meeting.dailyRoomName,
            hostUserId: meeting.hostId,
            organizationId: meeting.organizationId,
          });

          if (syncResult.found && syncResult.asset) {
            const hasPlayableRecording = Boolean(syncResult.asset.playUrl || syncResult.asset.downloadUrl);
            updateData.recordingStatus =
              !syncResult.asset.isProcessing && hasPlayableRecording
                ? MeetingRecordingStatus.AVAILABLE
                : MeetingRecordingStatus.PENDING;
            updateData.recordingPlayUrl = syncResult.asset.playUrl;
            updateData.recordingDownloadUrl = syncResult.asset.downloadUrl;
            updateData.recordingExternalId = syncResult.asset.externalId;
            updateData.recordingSyncedAt = new Date();
          } else if (shouldMarkRecordingAsFailed(meeting.endTime)) {
            updateData.recordingStatus = MeetingRecordingStatus.FAILED;
            updateData.recordingSyncedAt = new Date();
          }
        } catch {
          if (shouldMarkRecordingAsFailed(meeting.endTime)) {
            updateData.recordingStatus = MeetingRecordingStatus.FAILED;
            updateData.recordingSyncedAt = new Date();
          }
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.meeting.update({
          where: { id: meeting.id },
          data: updateData,
        });
      }

      return {
        ...meeting,
        ...updateData,
        status: nextStatus,
      };
    }),
  );

  const meetingsWithSafeJoin = nowStatusSynced.map((meeting) => {
    const participantJoinUrl = buildZohoMeetingJoinUrl(meeting.dailyRoomName, meeting.dailyRoomUrl);
    return {
      ...meeting,
      dailyRoomUrl:
        meeting.hostId === session.user.id ? meeting.dailyRoomUrl : participantJoinUrl ?? meeting.dailyRoomUrl,
    };
  });

  const meetingsForRole = canViewRecordings
    ? meetingsWithSafeJoin
    : meetingsWithSafeJoin.map((meeting) => ({
        ...meeting,
        recordingPlayUrl: null,
        recordingDownloadUrl: null,
      }));

  return ok({ meetings: meetingsForRole, scope: canLoadOrgRecordings ? "recordings" : "participant" });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (!HOST_ROLES.includes(session.user.role)) {
    return fail("Forbidden", 403);
  }

  try {
    const body = await request.json();
    const parsed = createMeetingSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid meeting payload.", 400, parsed.error.flatten());
    }

    const startTime = new Date(parsed.data.startTime);
    const endTime = new Date(parsed.data.endTime);
    if (endTime.getTime() <= startTime.getTime()) {
      return fail("Meeting end time must be later than start time.", 400);
    }

    const participants = [...new Set([session.user.id, ...parsed.data.participantIds])];
    const participantUsers = await prisma.user.findMany({
      where: {
        id: { in: participants },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
    if (participantUsers.length !== participants.length) {
      return fail("One or more selected participants were not found.", 400);
    }

    const room = await createZohoMeetingSession({
      topic: parsed.data.title,
      agenda: parsed.data.description,
      startTime,
      endTime,
      participantEmails: participantUsers.map((user) => user.email),
      hostUserId: session.user.id,
      organizationId: session.user.organizationId,
    });

    const status = getMeetingStatus(startTime, endTime);
    const recordingMode = resolveRecordingMode(participantUsers.map((user) => user.role));
    const recordingStatus = defaultRecordingStatus(recordingMode);

    const meeting = await prisma.meeting.create({
      data: {
        organizationId: session.user.organizationId ?? undefined,
        cohortId: parsed.data.cohortId,
        hostId: session.user.id,
        title: parsed.data.title,
        description: parsed.data.description,
        startTime,
        endTime,
        dailyRoomName: room.name,
        dailyRoomUrl: room.url,
        status,
        recordingMode,
        recordingStatus,
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
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("Zoho Meeting is not connected") ||
      message.includes("Stored Zoho connection has no refresh token")
    ) {
      return fail(message, 400);
    }
    return fail("Could not create meeting.", 500, error instanceof Error ? error.message : error);
  }
}

export async function PATCH(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (!HOST_ROLES.includes(session.user.role)) {
    return fail("Forbidden", 403);
  }

  try {
    const body = (await request.json()) as {
      meetingId?: string;
      participantIds?: string[];
      status?: MeetingStatus;
      syncRecording?: boolean;
    };

    if (!body.meetingId) {
      return fail("meetingId is required.", 400);
    }

    const meeting = await prisma.meeting.findUnique({
      where: { id: body.meetingId },
      select: {
        id: true,
        hostId: true,
        organizationId: true,
        status: true,
        endTime: true,
        dailyRoomName: true,
        recordingMode: true,
        recordingStatus: true,
      },
    });
    if (!meeting) {
      return fail("Meeting not found.", 404);
    }

    const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;
    const isAdminOrInstructor =
      session.user.role === UserRole.ADMIN || session.user.role === UserRole.INSTRUCTOR;
    const isHost = meeting.hostId === session.user.id;
    const isCancelRequest = body.status === MeetingStatus.CANCELLED;
    const isNonCancelStatusChange = Boolean(body.status) && body.status !== MeetingStatus.CANCELLED;
    const isParticipantMutation = Boolean(body.participantIds);
    const isRecordingSync = Boolean(body.syncRecording);

    const canCancel = isSuperAdmin || (isHost && isAdminOrInstructor);
    if (isCancelRequest && !canCancel) {
      return fail("Forbidden", 403);
    }

    const canManageOtherMutations = isSuperAdmin || isHost;
    if ((isNonCancelStatusChange || isParticipantMutation) && !canManageOtherMutations) {
      return fail("Forbidden", 403);
    }
    if (isRecordingSync && !isSuperAdmin) {
      return fail("Only super admins can sync recordings.", 403);
    }

    const meetingData: {
      status?: MeetingStatus;
      recordingMode?: MeetingRecordingMode;
      recordingStatus?: MeetingRecordingStatus;
      recordingPlayUrl?: string | null;
      recordingDownloadUrl?: string | null;
      recordingExternalId?: string | null;
      recordingSyncedAt?: Date;
    } = {};

    if (body.status) {
      meetingData.status = body.status;
    }

    if (body.participantIds) {
      const participants = [...new Set([meeting.hostId, ...body.participantIds])];
      const participantUsers = await prisma.user.findMany({
        where: {
          id: { in: participants },
        },
        select: {
          id: true,
          role: true,
        },
      });
      if (participantUsers.length !== participants.length) {
        return fail("One or more selected participants were not found.", 400);
      }

      const recordingMode = resolveRecordingMode(participantUsers.map((participant) => participant.role));
      meetingData.recordingMode = recordingMode;
      if (meeting.recordingStatus !== MeetingRecordingStatus.AVAILABLE) {
        meetingData.recordingStatus = defaultRecordingStatus(recordingMode);
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

    if (body.syncRecording) {
      const activeMode = meetingData.recordingMode ?? meeting.recordingMode;
      try {
        const syncResult = await syncZohoMeetingRecording({
          meetingKey: meeting.dailyRoomName,
          hostUserId: meeting.hostId,
          organizationId: meeting.organizationId,
        });

        meetingData.recordingSyncedAt = new Date();
        if (syncResult.found && syncResult.asset) {
          const hasPlayableRecording = Boolean(syncResult.asset.playUrl || syncResult.asset.downloadUrl);
          meetingData.recordingStatus =
            !syncResult.asset.isProcessing && hasPlayableRecording
              ? MeetingRecordingStatus.AVAILABLE
              : MeetingRecordingStatus.PENDING;
          meetingData.recordingPlayUrl = syncResult.asset.playUrl;
          meetingData.recordingDownloadUrl = syncResult.asset.downloadUrl;
          meetingData.recordingExternalId = syncResult.asset.externalId;
        } else if (activeMode === MeetingRecordingMode.AUTO_REQUIRED) {
          const effectiveStatus = meetingData.status ?? meeting.status;
          meetingData.recordingStatus =
            effectiveStatus === MeetingStatus.ENDED && shouldMarkRecordingAsFailed(meeting.endTime)
              ? MeetingRecordingStatus.FAILED
              : MeetingRecordingStatus.PENDING;
        }
      } catch {
        if (activeMode === MeetingRecordingMode.AUTO_REQUIRED) {
          const effectiveStatus = meetingData.status ?? meeting.status;
          meetingData.recordingStatus =
            effectiveStatus === MeetingStatus.ENDED && shouldMarkRecordingAsFailed(meeting.endTime)
              ? MeetingRecordingStatus.FAILED
              : MeetingRecordingStatus.PENDING;
          meetingData.recordingSyncedAt = new Date();
        }
      }
    }

    const updated =
      Object.keys(meetingData).length > 0
        ? await prisma.meeting.update({
            where: { id: meeting.id },
            data: meetingData,
            include: {
              host: { select: { id: true, firstName: true, lastName: true, role: true } },
              participants: {
                include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
              },
            },
          })
        : await prisma.meeting.findUnique({
            where: { id: meeting.id },
            include: {
              host: { select: { id: true, firstName: true, lastName: true, role: true } },
              participants: {
                include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
              },
            },
          });

    if (!updated) {
      return fail("Meeting not found.", 404);
    }

    return ok({ meeting: updated });
  } catch (error) {
    return fail("Could not update meeting.", 500, error instanceof Error ? error.message : error);
  }
}

import "server-only";
import { MeetingStatus, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import {
  fetchZohoUserDetails,
  getZohoMeetingApiRoot,
  refreshZohoAccessToken,
} from "./zoho-oauth";

const ZOHO_MEETING_JOIN_BASE_URL = (process.env.ZOHO_MEETING_JOIN_BASE_URL ?? "https://meet.zoho.com").replace(
  /\/$/,
  "",
);
const ZOHO_MEETING_TIMEZONE = process.env.ZOHO_MEETING_TIMEZONE ?? "UTC";

type CreateZohoMeetingInput = {
  topic: string;
  agenda?: string | null;
  startTime: Date;
  endTime: Date;
  participantEmails: string[];
  hostUserId?: string;
  organizationId?: string | null;
};

type ZohoCreateSessionResponse = {
  session?: Record<string, unknown>;
};

type ZohoRecordingAsset = {
  externalId: string | null;
  playUrl: string | null;
  downloadUrl: string | null;
  status: string | null;
  isProcessing: boolean;
};

function formatZohoStartTime(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(value);

  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const month = getPart("month");
  const day = getPart("day");
  const year = getPart("year");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const dayPeriod = getPart("dayPeriod");
  return `${month} ${day}, ${year} ${hour}:${minute} ${dayPeriod}`;
}

type StoredZohoConnection = {
  id: string;
  userId: string;
  refreshToken: string | null;
  accessToken: string | null;
  expiresAt: number | null;
  sessionState: string | null;
  providerAccountId: string;
  userRole: UserRole;
};

type SessionStatePayload = {
  zsoid?: string;
  presenterId?: string;
  connectedAt?: string;
};

function parseSessionState(value: string | null): SessionStatePayload {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value) as SessionStatePayload;
  } catch {
    return {};
  }
}

function hasEnvZohoConnection() {
  const staticToken = process.env.ZOHO_MEETING_ACCESS_TOKEN?.trim();
  if (staticToken) {
    return true;
  }
  const refreshToken = process.env.ZOHO_MEETING_REFRESH_TOKEN?.trim();
  const clientId = process.env.ZOHO_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_OAUTH_CLIENT_SECRET?.trim();
  return Boolean(refreshToken && clientId && clientSecret);
}

function rolePriority(role: UserRole) {
  if (role === UserRole.SUPER_ADMIN) {
    return 0;
  }
  if (role === UserRole.ADMIN) {
    return 1;
  }
  return 2;
}

async function findStoredZohoConnection(input: {
  hostUserId?: string;
  organizationId?: string | null;
}) {
  if (input.hostUserId) {
    const hostConnection = await prisma.oAuthAccount.findFirst({
      where: {
        provider: "zoho_meeting",
        userId: input.hostUserId,
      },
      include: {
        user: {
          select: { role: true },
        },
      },
      orderBy: { id: "desc" },
    });
    if (hostConnection) {
      return {
        id: hostConnection.id,
        userId: hostConnection.userId,
        refreshToken: hostConnection.refreshToken,
        accessToken: hostConnection.accessToken,
        expiresAt: hostConnection.expiresAt,
        sessionState: hostConnection.sessionState,
        providerAccountId: hostConnection.providerAccountId,
        userRole: hostConnection.user.role,
      } satisfies StoredZohoConnection;
    }
  }

  if (!input.organizationId) {
    return null;
  }

  const orgConnections = await prisma.oAuthAccount.findMany({
    where: {
      provider: "zoho_meeting",
      user: { organizationId: input.organizationId },
    },
    include: {
      user: {
        select: { role: true },
      },
    },
    orderBy: { id: "desc" },
    take: 20,
  });

  if (orgConnections.length === 0) {
    return null;
  }

  const preferred = [...orgConnections].sort((a, b) => {
    const roleDiff = rolePriority(a.user.role) - rolePriority(b.user.role);
    if (roleDiff !== 0) {
      return roleDiff;
    }
    return (b.expiresAt ?? 0) - (a.expiresAt ?? 0);
  })[0];

  return {
    id: preferred.id,
    userId: preferred.userId,
    refreshToken: preferred.refreshToken,
    accessToken: preferred.accessToken,
    expiresAt: preferred.expiresAt,
    sessionState: preferred.sessionState,
    providerAccountId: preferred.providerAccountId,
    userRole: preferred.user.role,
  } satisfies StoredZohoConnection;
}

async function getZohoAccessToken(input: { hostUserId?: string; organizationId?: string | null }) {
  const staticToken = process.env.ZOHO_MEETING_ACCESS_TOKEN?.trim();
  if (staticToken) {
    return { accessToken: staticToken, connection: null as StoredZohoConnection | null };
  }

  const envRefreshToken = process.env.ZOHO_MEETING_REFRESH_TOKEN?.trim();
  if (envRefreshToken) {
    const token = await refreshZohoAccessToken(envRefreshToken);
    return { accessToken: token.access_token!, connection: null as StoredZohoConnection | null };
  }

  const connection = await findStoredZohoConnection(input);
  if (!connection) {
    throw new Error("Zoho Meeting is not connected for this organization.");
  }

  const nowEpoch = Math.floor(Date.now() / 1000);
  if (connection.accessToken && connection.expiresAt && connection.expiresAt > nowEpoch + 90) {
    return { accessToken: connection.accessToken, connection };
  }
  if (!connection.refreshToken) {
    throw new Error("Stored Zoho connection has no refresh token. Reconnect Zoho with consent.");
  }

  const refreshed = await refreshZohoAccessToken(connection.refreshToken);
  const refreshedExpiresAt = refreshed.expires_in ? nowEpoch + refreshed.expires_in : connection.expiresAt;
  await prisma.oAuthAccount.update({
    where: { id: connection.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? connection.refreshToken,
      expiresAt: refreshedExpiresAt ?? undefined,
      tokenType: refreshed.token_type ?? undefined,
      scope: refreshed.scope ?? undefined,
    },
  });

  return {
    accessToken: refreshed.access_token!,
    connection: {
      ...connection,
      accessToken: refreshed.access_token!,
      refreshToken: refreshed.refresh_token ?? connection.refreshToken,
      expiresAt: refreshedExpiresAt ?? connection.expiresAt,
    },
  };
}

async function getZohoSessionContext(accessToken: string, connection: StoredZohoConnection | null) {
  const envZsoid = process.env.ZOHO_MEETING_ZSOID?.trim();
  const envPresenter = process.env.ZOHO_MEETING_PRESENTER_ID?.trim();
  if (envZsoid && envPresenter) {
    return { zsoid: envZsoid, presenter: Number(envPresenter) || envPresenter };
  }

  const stored = parseSessionState(connection?.sessionState ?? null);
  if (stored.zsoid && stored.presenterId) {
    return {
      zsoid: stored.zsoid,
      presenter: Number(stored.presenterId) || stored.presenterId,
    };
  }

  const details = await fetchZohoUserDetails(accessToken);
  if (connection) {
    await prisma.oAuthAccount.update({
      where: { id: connection.id },
      data: {
        sessionState: JSON.stringify({
          ...stored,
          zsoid: details.zsoid,
          presenterId: details.zuid,
        }),
      },
    });
  }
  return {
    zsoid: details.zsoid,
    presenter: Number(details.zuid) || details.zuid,
  };
}

async function requestCreateSession(
  accessToken: string,
  zsoid: string,
  payload: {
    topic: string;
    agenda?: string;
    presenter: string | number;
    startTime: string;
    duration: number;
    timezone: string;
    participants?: Array<{ email: string }>;
  },
) {
  const url = `${getZohoMeetingApiRoot()}/${encodeURIComponent(zsoid)}/sessions.json`;
  const jsonBody = JSON.stringify({ session: payload });

  const jsonAttempt = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: jsonBody,
  });

  if (jsonAttempt.ok) {
    return (await jsonAttempt.json()) as ZohoCreateSessionResponse;
  }

  const firstError = await jsonAttempt.text();
  const formAttempt = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({
      JSONString: jsonBody,
    }).toString(),
  });

  if (!formAttempt.ok) {
    const secondError = await formAttempt.text();
    throw new Error(`Failed to create Zoho meeting session: ${firstError || secondError}`);
  }

  return (await formAttempt.json()) as ZohoCreateSessionResponse;
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractMeetingKeyFromUrl(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    return pathParts[pathParts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function looksLikeHostStartLink(value: string) {
  const text = value.toLowerCase();
  return (
    text.includes("startlink") ||
    text.includes("start_link") ||
    text.includes("hostlink") ||
    text.includes("host_link") ||
    text.includes("presenterlink") ||
    text.includes("presenter_link") ||
    text.includes("zak=") ||
    text.includes("host=true") ||
    text.includes("presenter=true")
  );
}

export function buildZohoMeetingJoinUrl(meetingKey: string | null, fallbackUrl?: string | null) {
  const normalizedKey = meetingKey?.trim() ?? "";
  if (!normalizedKey) {
    return fallbackUrl ?? null;
  }
  return `${ZOHO_MEETING_JOIN_BASE_URL}/${encodeURIComponent(normalizedKey)}`;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = asNonEmptyString(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function looksLikeRecordingRecord(record: Record<string, unknown>) {
  return Boolean(
    pickString(record, [
      "recordingUrl",
      "recording_url",
      "recordingLink",
      "recording_link",
      "playUrl",
      "play_url",
      "playLink",
      "play_link",
      "downloadUrl",
      "download_url",
      "downloadLink",
      "download_link",
      "url",
      "id",
      "recordingId",
      "recording_id",
      "recordingKey",
      "recording_key",
    ]),
  );
}

function extractRecordingRecords(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [] as Array<Record<string, unknown>>;
  }

  const queue: unknown[] = [payload];
  const results: Array<Record<string, unknown>> = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (Array.isArray(current)) {
      for (const entry of current) {
        queue.push(entry);
      }
      continue;
    }

    if (typeof current !== "object") {
      continue;
    }

    const record = current as Record<string, unknown>;
    if (looksLikeRecordingRecord(record)) {
      results.push(record);
    }

    for (const key of ["recordings", "recording", "data", "items", "response", "session", "result"]) {
      if (key in record) {
        queue.push(record[key]);
      }
    }
  }

  return results;
}

function parseZohoRecordingAsset(payload: unknown): ZohoRecordingAsset | null {
  const records = extractRecordingRecords(payload);
  if (records.length === 0) {
    return null;
  }

  const preferred =
    records.find((record) =>
      Boolean(
        pickString(record, [
          "recordingUrl",
          "recording_url",
          "recordingLink",
          "recording_link",
          "playUrl",
          "play_url",
          "playLink",
          "play_link",
          "downloadUrl",
          "download_url",
          "downloadLink",
          "download_link",
        ]),
      ),
    ) ?? records[0];

  const rawStatus = pickString(preferred, ["status", "recordingStatus", "recording_status", "state"]);
  const normalizedStatus = rawStatus ? rawStatus.toUpperCase() : null;
  const playUrl = pickString(preferred, [
    "playUrl",
    "play_url",
    "playLink",
    "play_link",
    "recordingUrl",
    "recording_url",
    "recordingLink",
    "recording_link",
    "url",
  ]);
  const downloadUrl = pickString(preferred, ["downloadUrl", "download_url", "downloadLink", "download_link", "fileUrl", "file_url"]);
  const externalId = pickString(preferred, ["id", "recordingId", "recording_id", "recordingKey", "recording_key"]);
  const isProcessing = Boolean(
    normalizedStatus && /(PENDING|PROCESS|GENERAT|UPLOAD|QUEUE|IN_PROGRESS)/.test(normalizedStatus),
  );

  return {
    externalId,
    playUrl,
    downloadUrl,
    status: normalizedStatus,
    isProcessing,
  };
}

async function requestZohoRecordingPayload(accessToken: string, zsoid: string, meetingKey: string) {
  const apiRoot = getZohoMeetingApiRoot();
  const encodedZsoid = encodeURIComponent(zsoid);
  const encodedMeetingKey = encodeURIComponent(meetingKey);
  const endpoints = [
    `${apiRoot}/${encodedZsoid}/sessions/${encodedMeetingKey}/recordings.json`,
    `${apiRoot}/${encodedZsoid}/recordings/${encodedMeetingKey}.json`,
    `${apiRoot}/${encodedZsoid}/recordings.json?meetingKey=${encodedMeetingKey}`,
    `${apiRoot}/${encodedZsoid}/recordings.json?meeting_key=${encodedMeetingKey}`,
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return await response.json().catch(() => null);
    }

    const responseBody = await response.text();
    if (response.status === 404 || response.status === 400 || response.status === 422) {
      continue;
    }

    throw new Error(`Failed to fetch Zoho recording details: ${responseBody || response.status}`);
  }

  return null;
}

export async function syncZohoMeetingRecording(input: {
  meetingKey: string;
  hostUserId?: string;
  organizationId?: string | null;
}) {
  const meetingKey = input.meetingKey.trim();
  if (!meetingKey) {
    return { found: false as const, asset: null as ZohoRecordingAsset | null };
  }

  const storedConnection = await findStoredZohoConnection({
    hostUserId: input.hostUserId,
    organizationId: input.organizationId ?? null,
  });
  if (!hasEnvZohoConnection() && !storedConnection) {
    return { found: false as const, asset: null as ZohoRecordingAsset | null };
  }

  const { accessToken, connection } = await getZohoAccessToken({
    hostUserId: input.hostUserId,
    organizationId: input.organizationId ?? null,
  });
  const { zsoid } = await getZohoSessionContext(accessToken, connection);
  const payload = await requestZohoRecordingPayload(accessToken, zsoid, meetingKey);
  const asset = parseZohoRecordingAsset(payload);

  return {
    found: Boolean(asset),
    asset,
  };
}

export async function createZohoMeetingSession(input: CreateZohoMeetingInput) {
  const storedConnection = await findStoredZohoConnection({
    hostUserId: input.hostUserId,
    organizationId: input.organizationId ?? null,
  });
  if (!hasEnvZohoConnection() && !storedConnection) {
    throw new Error("Zoho Meeting is not connected for this organization. Connect Zoho before scheduling sessions.");
  }

  const { accessToken, connection } = await getZohoAccessToken({
    hostUserId: input.hostUserId,
    organizationId: input.organizationId ?? null,
  });
  const { zsoid, presenter } = await getZohoSessionContext(accessToken, connection);
  const duration = Math.max(60_000, input.endTime.getTime() - input.startTime.getTime());

  const response = await requestCreateSession(accessToken, zsoid, {
    topic: input.topic,
    agenda: input.agenda ?? undefined,
    presenter,
    startTime: formatZohoStartTime(input.startTime, ZOHO_MEETING_TIMEZONE),
    duration,
    timezone: ZOHO_MEETING_TIMEZONE,
    participants: input.participantEmails
      .filter(Boolean)
      .map((email) => ({ email: email.trim().toLowerCase() })),
  });

  const sessionRecord =
    response.session && typeof response.session === "object" ? response.session : ({} as Record<string, unknown>);
  const rawJoinLink = pickString(sessionRecord, [
    "joinLink",
    "join_link",
    "joinUrl",
    "join_url",
    "attendeeLink",
    "attendee_link",
  ]);
  const genericMeetingLink = pickString(sessionRecord, ["meetingLink", "meeting_link", "url"]);
  const startLink = pickString(sessionRecord, [
    "startLink",
    "start_link",
    "hostLink",
    "host_link",
    "presenterLink",
    "presenter_link",
  ]);
  const meetingKeyFromPayload = pickString(sessionRecord, [
    "meetingKey",
    "meeting_key",
    "sessionKey",
    "session_key",
    "key",
    "meetingId",
    "meeting_id",
  ]);
  const effectiveJoinLink =
    rawJoinLink && !looksLikeHostStartLink(rawJoinLink)
      ? rawJoinLink
      : genericMeetingLink && !looksLikeHostStartLink(genericMeetingLink)
        ? genericMeetingLink
        : null;
  const meetingKeyFromJoinLink = extractMeetingKeyFromUrl(effectiveJoinLink ?? rawJoinLink ?? genericMeetingLink);
  const meetingKeyFromStartLink = extractMeetingKeyFromUrl(startLink);
  const meetingKey = meetingKeyFromJoinLink ?? meetingKeyFromPayload ?? meetingKeyFromStartLink;
  if (!meetingKey) {
    throw new Error("Zoho Meeting response is missing meeting key.");
  }

  const participantJoinUrl = buildZohoMeetingJoinUrl(meetingKey, effectiveJoinLink);
  if (!participantJoinUrl) {
    throw new Error("Zoho Meeting did not return a participant join link.");
  }

  return {
    name: meetingKey,
    url: participantJoinUrl,
  };
}

export function getMeetingStatus(startTime: Date, endTime: Date): MeetingStatus {
  const now = Date.now();
  if (now < startTime.getTime()) {
    return MeetingStatus.UPCOMING;
  }
  if (now >= startTime.getTime() && now <= endTime.getTime()) {
    return MeetingStatus.LIVE;
  }
  return MeetingStatus.ENDED;
}

import { createHmac } from "crypto";
import { MeetingStatus } from "@prisma/client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function base64url(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${sig}`;
}

// ── Config ────────────────────────────────────────────────────────────────────

export function isJitsiConfigured(): boolean {
  return !!(process.env.JITSI_APP_ID && process.env.JITSI_APP_SECRET && process.env.JITSI_DOMAIN);
}

function requireJitsiConfig() {
  const appId = process.env.JITSI_APP_ID;
  const appSecret = process.env.JITSI_APP_SECRET;
  const domain = process.env.JITSI_DOMAIN;
  if (!appId || !appSecret || !domain) {
    throw new Error(
      "Jitsi is not configured. Set JITSI_APP_ID, JITSI_APP_SECRET, and JITSI_DOMAIN.",
    );
  }
  return { appId, appSecret, domain };
}

// ── Room name generation ──────────────────────────────────────────────────────

/** Generates a short collision-resistant Jitsi room name, e.g. "kat-a3f9k2m8p1qx" */
export function generateRoomName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  for (const b of bytes) suffix += chars[b % chars.length];
  return `kat-${suffix}`;
}

// ── JWT + URL ─────────────────────────────────────────────────────────────────

export type JitsiUser = {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isModerator: boolean;
};

/**
 * Generates a signed Jitsi join URL for a specific user and room.
 * The JWT is valid for 4 hours from the time of generation.
 */
export function buildJitsiJoinUrl(roomName: string, user: JitsiUser): string {
  const { appId, appSecret, domain } = requireJitsiConfig();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    context: {
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl ?? undefined,
        moderator: user.isModerator,
      },
    },
    aud: "jitsi",
    iss: appId,
    sub: domain,
    room: roomName,
    exp: now + 4 * 60 * 60, // 4 hours
    nbf: now - 30,
  };

  const jwt = signJwt(payload, appSecret);
  return `https://${domain}/${roomName}?jwt=${jwt}`;
}

/** Returns the base meeting URL without a JWT (for display/sharing purposes). */
export function buildJitsiBaseUrl(roomName: string): string {
  const domain = process.env.JITSI_DOMAIN;
  if (!domain) throw new Error("JITSI_DOMAIN is not set.");
  return `https://${domain}/${roomName}`;
}

// ── Status helper ─────────────────────────────────────────────────────────────

/** Derives the current MeetingStatus from start/end times. */
export function getMeetingStatus(startTime: Date, endTime: Date): MeetingStatus {
  const now = Date.now();
  if (now < startTime.getTime()) return MeetingStatus.UPCOMING;
  if (now >= startTime.getTime() && now < endTime.getTime()) return MeetingStatus.LIVE;
  return MeetingStatus.ENDED;
}

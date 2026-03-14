import "server-only";
import crypto from "crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateAdminInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashAdminInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildAdminInviteUrl(token: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${baseUrl}/register/staff?token=${encodeURIComponent(token)}`;
}

type InviteStatusSource = {
  expiresAt: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
};

export function getAdminInviteStatus(invite: InviteStatusSource) {
  if (invite.revokedAt) {
    return "revoked" as const;
  }
  if (invite.usedAt) {
    return "used" as const;
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    return "expired" as const;
  }
  return "valid" as const;
}

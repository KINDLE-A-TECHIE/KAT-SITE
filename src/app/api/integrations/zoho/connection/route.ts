import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/analytics";

type ConnectionState = {
  zsoid?: string;
  presenterId?: string;
  connectedAt?: string;
};

function parseSessionState(value: string | null): ConnectionState {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(value) as ConnectionState;
  } catch {
    return {};
  }
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

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    return fail("Forbidden", 403);
  }

  const accounts = await prisma.oAuthAccount.findMany({
    where: {
      provider: "zoho_meeting",
      user: {
        organizationId: session.user.organizationId ?? undefined,
      },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { id: "desc" },
    take: 20,
  });

  if (accounts.length === 0) {
    return ok({
      connected: false,
    });
  }

  const preferred = [...accounts].sort((a, b) => {
    const byRole = rolePriority(a.user.role) - rolePriority(b.user.role);
    if (byRole !== 0) {
      return byRole;
    }
    return (b.expiresAt ?? 0) - (a.expiresAt ?? 0);
  })[0];

  const state = parseSessionState(preferred.sessionState);
  return ok({
    connected: true,
    connection: {
      accountId: preferred.id,
      providerAccountId: preferred.providerAccountId,
      hasRefreshToken: Boolean(preferred.refreshToken),
      expiresAt: preferred.expiresAt,
      connectedBy: preferred.user,
      connectedAt: state.connectedAt ?? new Date().toISOString(),
      zsoid: state.zsoid ?? null,
      presenterId: state.presenterId ?? preferred.providerAccountId,
    },
  });
}

export async function DELETE() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }
  if (session.user.role !== UserRole.SUPER_ADMIN) {
    return fail("Forbidden", 403);
  }

  const deleted = await prisma.oAuthAccount.deleteMany({
    where: {
      provider: "zoho_meeting",
      user: {
        organizationId: session.user.organizationId ?? undefined,
      },
    },
  });

  await trackEvent({
    userId: session.user.id,
    organizationId: session.user.organizationId,
    eventType: "integration",
    eventName: "zoho_meeting_disconnected",
    payload: {
      removedConnections: deleted.count,
    },
  });

  return ok({ success: true, removedConnections: deleted.count });
}

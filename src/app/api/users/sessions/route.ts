import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list all active sessions for the current user
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const sessions = await prisma.userSession.findMany({
    where: { userId: session.user.id },
    select: { id: true, sessionToken: true, createdAt: true, expires: true },
    orderBy: { createdAt: "desc" },
  });

  return ok({ sessions, currentToken: session.user.sessionToken ?? null });
}

// DELETE — revoke all sessions except the current one (or all if ?all=true)
export async function DELETE(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  const currentToken = session.user.sessionToken ?? "";

  if (all) {
    await prisma.userSession.deleteMany({
      where: { userId: session.user.id },
    });
  } else {
    // Revoke all except the current session token
    await prisma.userSession.deleteMany({
      where: {
        userId: session.user.id,
        ...(currentToken ? { sessionToken: { not: currentToken } } : {}),
      },
    });
  }

  return ok({ message: "Sessions revoked." });
}

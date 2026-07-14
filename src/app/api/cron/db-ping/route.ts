import "server-only";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Lightweight endpoint called by an external cron service to keep the Neon DB awake.
// Secured by Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("CRON_SECRET not configured.", 500);

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) return fail("Unauthorized", 401);

  await prisma.$queryRaw`SELECT 1`;

  return ok({ pong: true, timestamp: new Date().toISOString() });
}

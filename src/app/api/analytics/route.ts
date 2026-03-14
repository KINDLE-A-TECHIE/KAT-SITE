import { UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { getPlatformAnalytics, getUserAnalytics, trackEvent } from "@/lib/analytics";

const eventSchema = z.object({
  eventType: z.string().trim().min(1).max(80),
  eventName: z.string().trim().min(1).max(120),
  payload: z.unknown().optional(),
});

const rangeSchema = z.enum(["7d", "30d", "90d"]).default("30d");

const RANGE_TO_DAYS: Record<z.infer<typeof rangeSchema>, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const rangeParsed = rangeSchema.safeParse(url.searchParams.get("range") ?? undefined);
  if (!rangeParsed.success) {
    return fail("Invalid range. Use 7d, 30d, or 90d.", 400, rangeParsed.error.flatten());
  }
  const range = rangeParsed.data;
  const rangeDays = RANGE_TO_DAYS[range];

  const isAdmin = session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;

  if (isAdmin && session.user.organizationId) {
    const [userAnalytics, platformAnalytics] = await Promise.all([
      getUserAnalytics(session.user.id, rangeDays),
      getPlatformAnalytics(session.user.organizationId, rangeDays),
    ]);
    return ok({
      scope: "platform",
      range,
      viewerRole: session.user.role,
      userAnalytics,
      platformAnalytics,
    });
  }

  const userAnalytics = await getUserAnalytics(session.user.id, rangeDays);

  return ok({
    scope: "user",
    range,
    viewerRole: session.user.role,
    userAnalytics,
  });
}

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const body = await request.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid event payload.", 400, parsed.error.flatten());
  }

  await trackEvent({
    userId: session.user.id,
    organizationId: session.user.organizationId,
    eventType: parsed.data.eventType,
    eventName: parsed.data.eventName,
    payload: parsed.data.payload,
  });

  return ok({ success: true }, 201);
}

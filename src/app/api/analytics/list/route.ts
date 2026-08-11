import { UserRole } from "@prisma/client";
import { z } from "zod";
import { fail, ok } from "@/lib/http";
import { capabilityDenied } from "@/lib/capabilities";
import { getServerAuthSession } from "@/lib/auth";
import { getAnalyticsListPage } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

// Paginated leaderboards / per-school breakdown for the analytics dashboard. The main
// /api/analytics call returns only the first page of each list plus a total; this serves the rest.
const querySchema = z.object({
  type: z.enum(["programs", "cohorts", "schools"]),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(8),
});

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  // Same gate as the main analytics overview: admins only, and a capability-restricted admin who
  // lacks the "analytics" area gets nothing here either.
  const isAdmin = session.user.role === UserRole.SUPER_ADMIN || session.user.role === UserRole.ADMIN;
  if (!isAdmin || capabilityDenied(session.user, "analytics")) {
    return fail("Forbidden", 403);
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    type: url.searchParams.get("type"),
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return fail("Invalid query.", 400, parsed.error.flatten());
  }
  const { type, page, pageSize } = parsed.data;

  try {
    // Resolve organizationId (the JWT may predate the assignment) for the org-scoped B2C lists.
    let orgId = session.user.organizationId ?? null;
    if (!orgId && (type === "programs" || type === "cohorts")) {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { organizationId: true },
      });
      orgId = dbUser?.organizationId ?? null;
    }

    const result = await getAnalyticsListPage(type, { organizationId: orgId, page, pageSize });
    return ok(result);
  } catch (error) {
    return fail("Failed to load analytics list.", 500, error instanceof Error ? error.message : String(error));
  }
}

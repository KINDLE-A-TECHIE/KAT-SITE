import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

// GET /api/users?roles=STUDENT,FELLOW
// Returns users filtered by role(s) — restricted to issuers
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ALLOWED_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const url = new URL(request.url);
  const rolesParam = url.searchParams.get("roles");
  const roleFilter = rolesParam
    ? (rolesParam.split(",").map(r => r.trim().toUpperCase()) as UserRole[])
    : undefined;

  const users = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId ?? undefined,
      ...(roleFilter ? { role: { in: roleFilter } } : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return ok({ users });
}

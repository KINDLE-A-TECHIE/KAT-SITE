import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { orgScope } from "@/lib/tenant";
import { SCHOOL_ROLES } from "@/lib/roles";
import { readPageOffset, pageMeta } from "@/lib/pagination";

const ALLOWED_ROLES: UserRole[] = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

// GET /api/users?roles=STUDENT,FELLOW
// Returns users filtered by role(s), restricted to issuers
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ALLOWED_ROLES.includes(session.user.role as UserRole)) return fail("Forbidden", 403);

  const url = new URL(request.url);
  const rolesParam = url.searchParams.get("roles");
  const roleFilter = rolesParam
    ? (rolesParam.split(",").map(r => r.trim().toUpperCase()) as UserRole[])
    : undefined;
  const q = url.searchParams.get("q")?.trim() ?? "";

  const { limit, page, skip } = readPageOffset(request);
  const where = {
    ...orgScope(session.user.organizationId),
    // roleFilter comes from the query string, so notIn goes INSIDE the same role filter rather
    // than as a sibling key that `in` would overwrite.
    role: { ...(roleFilter ? { in: roleFilter } : {}), notIn: SCHOOL_ROLES },
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ users, ...pageMeta(total, page, limit) });
}

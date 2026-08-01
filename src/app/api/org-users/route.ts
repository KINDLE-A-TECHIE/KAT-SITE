import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orgScope } from "@/lib/tenant";
import { readPageOffset, pageMeta } from "@/lib/pagination";

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const isAdmin =
    session.user.role === UserRole.SUPER_ADMIN ||
    session.user.role === UserRole.ADMIN;
  if (!isAdmin) return fail("Forbidden", 403);

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const roleFilter = url.searchParams.get("role"); // e.g. "STUDENT,FELLOW"

  const allowedRoles = roleFilter
    ? (roleFilter.split(",").filter((r) =>
        Object.values(UserRole).includes(r as UserRole),
      ) as UserRole[])
    : [UserRole.STUDENT, UserRole.FELLOW, UserRole.PARENT];

  const { limit, page, skip } = readPageOffset(request);
  const where = {
    ...orgScope(session.user.organizationId),
    role: { in: allowedRoles },
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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ users, ...pageMeta(total, page, limit) });
}
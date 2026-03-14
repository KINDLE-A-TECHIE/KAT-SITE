import { UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const users = await prisma.user.findMany({
    where: {
      organizationId: session.user.organizationId ?? undefined,
      role: { in: allowedRoles },
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 100,
  });

  return ok({ users });
}
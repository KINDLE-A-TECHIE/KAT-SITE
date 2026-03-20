import "server-only";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/waitlist/admin?cursor=&limit=50&search=
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return fail("Forbidden", 403);
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const search = url.searchParams.get("search")?.trim() ?? "";

  const where = search ? { email: { contains: search, mode: "insensitive" as const } } : {};

  const rows = await prisma.waitlistEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    select: { id: true, email: true, createdAt: true, notifiedAt: true },
  });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  const total = await prisma.waitlistEntry.count({ where });

  return ok({
    entries: rows,
    total,
    nextCursor: hasMore ? rows[rows.length - 1]?.id : null,
    hasMore,
  });
}

// DELETE /api/waitlist/admin  { id }
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return fail("Forbidden", 403);
  }

  const { id } = await request.json() as { id: string };
  if (!id) return fail("Missing id", 400);

  await prisma.waitlistEntry.delete({ where: { id } });
  return ok({ deleted: true });
}

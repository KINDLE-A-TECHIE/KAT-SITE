import { type Prisma, UserRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseIntParam(raw: string | null, fallback: number, max?: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  const floored = Math.floor(n);
  return max !== undefined ? Math.min(floored, max) : floored;
}

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return fail("Unauthorized", 401);
  }

  const url = new URL(request.url);
  const limit = parseIntParam(url.searchParams.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = parseIntParam(url.searchParams.get("offset"), 0);

  const role = session.user.role;
  const isAdmin = role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;

  // Instructors and fellows have no payment access.
  if (role === UserRole.INSTRUCTOR || role === UserRole.FELLOW) {
    return fail("Forbidden", 403);
  }

  // Parents see payments for themselves and all their linked children.
  let where: Prisma.PaymentWhereInput;

  if (role === UserRole.PARENT) {
    const childLinks = await prisma.parentStudent.findMany({
      where: { parentId: session.user.id },
      select: { childId: true },
    });
    const childIds = childLinks.map((l) => l.childId);
    where = { userId: { in: [session.user.id, ...childIds] } };
  } else if (isAdmin) {
    where = { user: { organizationId: session.user.organizationId ?? undefined } };
  } else {
    // STUDENT — own payments (read-only; parents pay on their behalf).
    where = { userId: session.user.id };
  }

  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      include: {
        receipt: true,
        program: { select: { id: true, name: true } },
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: [{ billingMonth: "desc" }, { initializedAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.payment.count({ where }),
  ]);

  const monthly = payments.reduce<Record<string, { total: number; successful: number; failed: number }>>(
    (acc, payment) => {
      const month = payment.billingMonth.toISOString().slice(0, 7);
      if (!acc[month]) {
        acc[month] = { total: 0, successful: 0, failed: 0 };
      }
      acc[month].total += Number(payment.amount);
      if (payment.status === "SUCCESS") {
        acc[month].successful += Number(payment.amount);
      }
      if (payment.status === "FAILED") {
        acc[month].failed += Number(payment.amount);
      }
      return acc;
    },
    {},
  );

  return ok({
    payments,
    monthly,
    meta: { total, limit, offset, hasMore: offset + limit < total },
  });
}

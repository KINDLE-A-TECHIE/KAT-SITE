import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ISSUER_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

const CERT_INCLUDE = {
  user:       { select: { id: true, firstName: true, lastName: true, email: true } },
  program:    { select: { id: true, name: true, level: true } },
  issuedBy:   { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

// GET — list certificates (own for learners, all for issuers)
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id, role } = session.user;
  const isIssuer = ISSUER_ROLES.includes(role);

  const certificates = await prisma.certificate.findMany({
    where: isIssuer ? {} : { userId: id, status: "APPROVED" },
    include: CERT_INCLUDE,
    orderBy: { issuedAt: "desc" },
  });

  return ok({ certificates });
}

// POST — issue (SUPER_ADMIN → auto-approved) or request (ADMIN/INSTRUCTOR → PENDING)
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ISSUER_ROLES.includes(session.user.role)) return fail("Forbidden", 403);

  const body = await request.json() as { userId?: string; programId?: string };
  const { userId, programId } = body;
  if (!userId || !programId) return fail("userId and programId are required");

  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!recipient) return fail("Recipient not found", 404);
  if (!["STUDENT", "FELLOW"].includes(recipient.role))
    return fail("Certificates can only be issued to students and fellows");

  const program = await prisma.program.findUnique({ where: { id: programId }, select: { id: true } });
  if (!program) return fail("Program not found", 404);

  const existing = await prisma.certificate.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  if (existing) return fail("A certificate request already exists for this student and programme");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const certificate = await prisma.certificate.create({
    data: {
      userId,
      programId,
      issuedById: session.user.id,
      status: isSuperAdmin ? "APPROVED" : "PENDING",
      ...(isSuperAdmin && { approvedById: session.user.id, approvedAt: new Date() }),
    },
    include: CERT_INCLUDE,
  });

  return ok({ certificate }, 201);
}

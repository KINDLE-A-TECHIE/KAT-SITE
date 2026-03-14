import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ISSUER_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

// GET — list certificates (own for learners, all for issuers)
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id, role } = session.user;
  const isIssuer = ISSUER_ROLES.includes(role);

  const certificates = await prisma.certificate.findMany({
    where: isIssuer ? {} : { userId: id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      program: { select: { id: true, name: true, level: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { issuedAt: "desc" },
  });

  return ok({ certificates });
}

// POST — issue a certificate (admin / instructor only)
export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);
  if (!ISSUER_ROLES.includes(session.user.role)) return fail("Forbidden", 403);

  const body = await request.json() as { userId?: string; programId?: string };
  const { userId, programId } = body;

  if (!userId || !programId) return fail("userId and programId are required");

  // Verify recipient exists and is a learner
  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, firstName: true, lastName: true },
  });
  if (!recipient) return fail("Recipient not found", 404);
  if (!["STUDENT", "FELLOW"].includes(recipient.role)) {
    return fail("Certificates can only be issued to students and fellows");
  }

  // Verify program exists
  const program = await prisma.program.findUnique({ where: { id: programId }, select: { id: true } });
  if (!program) return fail("Program not found", 404);

  // Check for duplicate
  const existing = await prisma.certificate.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  if (existing) return fail("Certificate already issued for this student and program");

  const certificate = await prisma.certificate.create({
    data: { userId, programId, issuedById: session.user.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      program: { select: { id: true, name: true, level: true } },
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return ok({ certificate }, 201);
}

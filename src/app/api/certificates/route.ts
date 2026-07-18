import { NotificationType } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCredentialId } from "@/lib/certificate";
import { readPageOffset, pageMeta } from "@/lib/pagination";

const ISSUER_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

const CERT_INCLUDE = {
  user:       { select: { id: true, firstName: true, lastName: true, email: true } },
  program:    { select: { id: true, name: true, level: true } },
  issuedBy:   { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

// GET, list certificates
// Learners: own APPROVED certs only
// Issuers:  all certs, optionally filtered by ?status=PENDING|APPROVED|REJECTED
export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  const { id, role } = session.user;
  const isIssuer = ISSUER_ROLES.includes(role);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as "PENDING" | "APPROVED" | "REJECTED" | null;

  const where = isIssuer
    ? status ? { status } : {}
    : { userId: id, status: "APPROVED" as const };

  const { limit, page, skip } = readPageOffset(request);
  const [certificates, total] = await prisma.$transaction([
    prisma.certificate.findMany({
      where,
      include: CERT_INCLUDE,
      orderBy: { issuedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.certificate.count({ where }),
  ]);

  return ok({ certificates, ...pageMeta(total, page, limit) });
}

// POST, issue (SUPER_ADMIN → auto-approved) or request (ADMIN/INSTRUCTOR → PENDING)
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

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, name: true },
  });
  if (!program) return fail("Program not found", 404);

  // Guard: student must be enrolled in the programme
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_programId: { userId, programId } },
    select: { id: true },
  });
  if (!enrollment) return fail("This student is not enrolled in the selected programme.", 422);

  const existing = await prisma.certificate.findUnique({
    where: { userId_programId: { userId, programId } },
  });
  if (existing) return fail("A certificate request already exists for this student and programme");

  const isSuperAdmin = session.user.role === "SUPER_ADMIN";

  const certificate = await prisma.certificate.create({
    data: {
      // Crypto-random, unguessable public verification id (NOT the cuid schema default).
      credentialId: generateCredentialId(),
      userId,
      programId,
      issuedById: session.user.id,
      status: isSuperAdmin ? "APPROVED" : "PENDING",
      ...(isSuperAdmin && { approvedById: session.user.id, approvedAt: new Date() }),
    },
    include: CERT_INCLUDE,
  });

  // When a SUPER_ADMIN directly issues a cert it's immediately approved,
  // notify the learner straight away so they don't have to check manually.
  if (isSuperAdmin) {
    await prisma.notification.create({
      data: {
        recipientId: userId,
        creatorId: session.user.id,
        type: NotificationType.SUCCESS,
        title: "Certificate issued",
        body: JSON.stringify({
          text: `Congratulations! You've been awarded a certificate for ${program.name}. View and download it now.`,
          targetPath: "/dashboard/certificates",
        }),
      },
    });
  }

  return ok({ certificate }, 201);
}

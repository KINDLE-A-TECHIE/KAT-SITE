import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Public — verify a certificate by credentialId (no auth required)
export async function GET(_req: Request, { params }: { params: Promise<{ credentialId: string }> }) {
  const { credentialId } = await params;

  const cert = await prisma.certificate.findUnique({
    where: { credentialId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      program: { select: { name: true, level: true } },
      issuedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!cert) return fail("Certificate not found", 404);
  if (cert.status !== "APPROVED") return fail("Certificate not found", 404);

  return ok({
    valid: true,
    credentialId: cert.credentialId,
    recipientName: `${cert.user.firstName} ${cert.user.lastName}`,
    programName: cert.program.name,
    programLevel: cert.program.level,
    issuedAt: cert.issuedAt,
    issuedBy: `${cert.issuedBy.firstName} ${cert.issuedBy.lastName}`,
  });
}

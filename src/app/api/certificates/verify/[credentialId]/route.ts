import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

// Public endpoint, no auth required.
// Verifies a certificate by its unique credentialId.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ credentialId: string }> },
) {
  const { credentialId } = await params;

  const certificate = await prisma.certificate.findUnique({
    where: { credentialId },
    include: {
      user:    { select: { firstName: true, lastName: true } },
      program: { select: { id: true, name: true, level: true } },
      issuedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!certificate || certificate.status !== "APPROVED") {
    return fail("Certificate not found or not yet approved.", 404);
  }

  return ok({
    certificate: {
      credentialId: certificate.credentialId,
      recipientName: `${certificate.user.firstName} ${certificate.user.lastName}`,
      program: certificate.program,
      issuedAt: certificate.issuedAt,
      approvedAt: certificate.approvedAt,
      issuedBy: `${certificate.issuedBy.firstName} ${certificate.issuedBy.lastName}`,
    },
  });
}

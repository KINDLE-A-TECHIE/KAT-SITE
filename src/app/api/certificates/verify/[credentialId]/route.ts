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

  if (certificate && certificate.status === "APPROVED") {
    return ok({
      certificate: {
        kind: "b2c",
        credentialId: certificate.credentialId,
        recipientName: `${certificate.user.firstName} ${certificate.user.lastName}`,
        program: certificate.program,
        issuedAt: certificate.issuedAt,
        approvedAt: certificate.approvedAt,
        issuedBy: `${certificate.issuedBy.firstName} ${certificate.issuedBy.lastName}`,
      },
    });
  }

  // A school term certificate. The pupil's name is only returned with recorded parental consent;
  // otherwise the credential still verifies as authentic without naming the child.
  const school = await prisma.schoolCertificate.findUnique({
    where: { credentialId },
    include: { school: { select: { name: true } } },
  });
  if (school && school.status === "ISSUED") {
    return ok({
      certificate: {
        kind: "school",
        credentialId: school.credentialId,
        recipientName: school.nameConsent ? school.pupilName : null,
        school: school.school.name,
        program: school.programTitle,
        term: school.termNumber,
        session: school.sessionLabel,
        highlights: school.highlightLessons,
        issuedAt: school.issuedAt,
      },
    });
  }

  return fail("Certificate not found or not yet approved.", 404);
}

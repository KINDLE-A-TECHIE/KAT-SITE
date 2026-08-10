import { SchoolCertificateStatus } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveEmbedPupil } from "@/lib/school-embed-pupil";

export const dynamic = "force-dynamic";

/**
 * GET the embed pupil's OWN issued certificates. Mirrors /api/school/certificates/mine but authed by the
 * embed session. Keyed on BOTH the session userId AND schoolId, so a caller only ever sees their own
 * certificates within their own school; revoked ones are excluded.
 */
export async function GET(request: Request) {
  const auth = await resolveEmbedPupil(request, { mutation: false });
  if (!auth.ok) return fail(auth.error, auth.status);

  const certificates = await prisma.schoolCertificate.findMany({
    where: { userId: auth.pupil.userId, schoolId: auth.pupil.schoolId, status: SchoolCertificateStatus.ISSUED },
    orderBy: { issuedAt: "desc" },
    select: {
      credentialId: true,
      programTitle: true,
      moduleTitle: true,
      sessionLabel: true,
      termNumber: true,
      highlightLessons: true,
      issuedAt: true,
    },
  });

  return ok({ certificates });
}

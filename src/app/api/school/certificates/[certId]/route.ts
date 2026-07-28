import { SchoolRole, SchoolCertificateStatus } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";

interface Params { params: Promise<{ certId: string }> }

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

/**
 * DELETE /api/school/certificates/[certId], revoke a school certificate. SCHOOL_ADMIN only.
 *
 * A soft revoke (status -> REVOKED, revokedAt set), never a hard delete: the record of what was issued
 * must survive, and the public verification page already treats a non-ISSUED credential as not found.
 * TENANT ISOLATION: the update is scoped by schoolId (from the session), so a foreign cert id matches
 * zero rows rather than being merely checked.
 */
export async function DELETE(_req: Request, { params }: Params) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  const { certId } = await params;

  const result = await prisma.schoolCertificate.updateMany({
    where: { id: certId, schoolId, status: SchoolCertificateStatus.ISSUED },
    data: { status: SchoolCertificateStatus.REVOKED, revokedAt: new Date() },
  });
  if (result.count === 0) return fail("Certificate not found.", 404);

  return ok({ revoked: true });
}

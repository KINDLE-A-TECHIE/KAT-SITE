import { SchoolCertificateStatus } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSchoolStudent } from "@/lib/school";

/**
 * GET /api/school/certificates/mine, the signed-in pupil's OWN issued certificates.
 *
 * Guarded by ensureSchoolStudent (a school pupil, enrolment-based, not a SchoolMembership), which also
 * yields their schoolId. The query is keyed on BOTH session.user.id and that schoolId, so a caller can
 * only ever see their own certificates, and only within their own school. Revoked ones are excluded.
 */
export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return fail("Unauthorized", 401);

  let schoolId: string;
  try {
    ({ schoolId } = await ensureSchoolStudent());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const certificates = await prisma.schoolCertificate.findMany({
    where: { userId: session.user.id, schoolId, status: SchoolCertificateStatus.ISSUED },
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

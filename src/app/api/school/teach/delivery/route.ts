import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveSchool } from "@/lib/school";
import { checkClassLicense } from "@/lib/school-license";
import { getPredecessor, teacherDisplayName } from "@/lib/school-teacher-history";
import { schoolUnitDeliverySchema } from "@/lib/validators";
import { captureError } from "@/lib/sentry";

/**
 * PATCH /api/school/teach/delivery, a teacher attests that they DELIVERED a unit.
 *
 * This is the only record of TEACHING in the system, and it ends up on a compliance
 * report a school may hand to an inspector. So it is:
 *   - teacher-only, and only for THEIR OWN class (scoped schoolId AND teacherId);
 *   - attributed (markedById records who stands behind the claim);
 *   - reversible (delivered: false clears it, in case of a mistake).
 *
 * A SCHOOL_ADMIN deliberately cannot mark delivery: an administrator attesting that
 * teaching happened, on a document shown to a regulator, is exactly the kind of
 * self-certification the report exists to avoid.
 *
 * BASIS. A teacher who inherits a class mid-term faces units she did not teach. Two of the three
 * available answers are dishonest, signing her predecessor's name (forgery), or leaving genuine
 * teaching to read as "not delivered" (understatement). The third is to let her say what is
 * actually true, under her own name: "my predecessor taught this, and I am recording it"
 * (basis = SUCCESSOR). The report then shows that claim for exactly what it is, second-hand,
 * and never blends it into the first-hand total.
 */
export async function PATCH(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.TEACHER]));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
  }

  const session = await getServerAuthSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = schoolUnitDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid payload.", 400, parsed.error.flatten());
  }
  const { classId, moduleId, delivered, basis = "FIRST_HAND" } = parsed.data;

  try {
    // The class must be THIS teacher's, in THIS school.
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: classId, schoolId, teacherId: session!.user.id },
      select: { id: true, sessionLabel: true, programId: true },
    });
    if (!schoolClass) return fail("Class not found.", 404);

    const gate = await checkClassLicense(schoolId, schoolClass.sessionLabel);
    if (!gate.allowed) return fail(gate.reason, 403);

    // The module must belong to the course this class is actually teaching, a teacher
    // cannot attest delivery of a unit their class does not study.
    const validModule = await prisma.module.findFirst({
      where: {
        id: moduleId,
        version: { curriculum: { programId: schoolClass.programId ?? "" } },
      },
      select: { id: true },
    });
    if (!validModule) return fail("That unit is not part of this class's course.", 422);

    // The attester's name is SNAPSHOTTED, not joined. markedById is SetNull on user delete, so a
    // teacher who later leaves the platform would otherwise leave an unattributed delivery claim
    // standing on a document shown to a regulator, and the name IS the claim.
    let markedByName: string | null = null;
    let taughtByName: string | null = null;

    if (delivered) {
      const me = await prisma.user.findUnique({
        where: { id: session!.user.id },
        select: { firstName: true, lastName: true },
      });
      markedByName = me ? teacherDisplayName(me) : null;

      if (basis === "SUCCESSOR") {
        // WHO is being credited is derived from the class's own history, never taken from the
        // request. A teacher who could name her predecessor in the body could credit anybody with
        // teaching she has no standing to vouch for.
        const predecessor = await getPredecessor(schoolId, classId);
        if (!predecessor) {
          return fail(
            "This class has not changed hands, so there is no predecessor to credit. Attest only what you taught.",
            422,
          );
        }
        taughtByName = predecessor.teacherName;
      }
    }

    const unit = await prisma.schoolClassUnit.upsert({
      where: { schoolClassId_moduleId: { schoolClassId: classId, moduleId } },
      update: {
        deliveredAt: delivered ? new Date() : null,
        markedById: delivered ? session!.user.id : null,
        markedByName,
        basis: delivered ? basis : null,
        taughtByName,
      },
      create: {
        schoolClassId: classId,
        moduleId,
        deliveredAt: delivered ? new Date() : null,
        markedById: delivered ? session!.user.id : null,
        markedByName,
        basis: delivered ? basis : null,
        taughtByName,
      },
      select: { moduleId: true, deliveredAt: true, basis: true, taughtByName: true },
    });

    return ok({
      moduleId: unit.moduleId,
      delivered: Boolean(unit.deliveredAt),
      deliveredAt: unit.deliveredAt,
      basis: unit.basis,
      taughtByName: unit.taughtByName,
    });
  } catch (error) {
    captureError(error);
    return fail("Could not update delivery.", 500);
  }
}

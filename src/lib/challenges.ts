import "server-only";
import { CourseAudience, NotificationType } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Challenges are a B2C feature.
 *
 * This used to live in `src/app/api/challenges/route.ts` and was imported route-to-route by
 * `challenges/[challengeId]/route.ts`. The App Router forbids a route file exporting anything but
 * handlers, for good reason: the import drags one route's whole module scope into another's
 * bundle. It also broke `next build` from a cold checkout while passing locally, because the
 * violation only surfaces once `.next/types` has been generated.
 */

/**
 * Rejects a program that a challenge may not be attached to.
 *
 * Challenges are B2C: they live on /dashboard/challenges, are surfaced by the B2C learner routes,
 * and carry no school licence gate. Attaching one to a SCHOOL program would notify a school's
 * children, pupils who cannot reach that surface and are not KAT customers, and enumerate them
 * on the way. Returns an error message, or null when the program is fine.
 */
export async function checkChallengeProgram(programId: string): Promise<string | null> {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { audience: true },
  });
  if (!program) return "Program not found.";
  if (program.audience === CourseAudience.SCHOOL) {
    return "Challenges are a B2C feature and cannot be attached to a SCHOOL programme. School pupils learn through their class, and would have no way to reach a challenge.";
  }
  return null;
}

/**
 * Notifies the learners eligible for a newly published challenge.
 *
 * TENANT SCOPE. `schoolId: null`. `Enrollment.schoolId` is exactly how a school child is enrolled
 * ("null = B2C" is the convention throughout), so an unscoped recipient query would have written
 * every pupil of a school a notification titled "🔥 New challenge dropped!" linking to
 * /dashboard/challenges: a surface they cannot open, for a product their school did not buy.
 *
 * Belt and braces: `checkChallengeProgram` above already refuses to attach a challenge to a SCHOOL
 * programme, so this filter should never have anything to exclude. It stays because a recipient
 * query that enumerates children must not depend on a caller elsewhere having remembered a check.
 */
export async function notifyEligibleStudents(
  challengeId: string,
  programId: string,
  moduleId: string | null,
  creatorId: string,
  challengeTitle: string,
) {
  let recipientIds: string[];

  if (moduleId) {
    const gateStatuses = await prisma.moduleGateStatus.findMany({
      where: {
        moduleId,
        enrollment: { programId, status: "ACTIVE", schoolId: null },
      },
      select: { userId: true },
    });
    recipientIds = gateStatuses.map((g) => g.userId);
  } else {
    const enrollments = await prisma.enrollment.findMany({
      where: { programId, status: "ACTIVE", schoolId: null },
      select: { userId: true },
    });
    recipientIds = enrollments.map((e) => e.userId);
  }

  if (recipientIds.length > 0) {
    await prisma.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        recipientId,
        creatorId,
        type: NotificationType.INFO,
        title: "🔥 New challenge dropped!",
        body: JSON.stringify({
          text: `A new challenge is live: "${challengeTitle}". Head to Challenges to compete!`,
          targetPath: "/dashboard/challenges",
        }),
      })),
      skipDuplicates: true,
    });
  }
}

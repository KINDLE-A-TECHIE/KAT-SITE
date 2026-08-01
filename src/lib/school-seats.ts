import "server-only";
import { SchoolLicenseStatus } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * The transaction client, typed structurally.
 *
 * Our prisma singleton is `$extends`-ed (retry wrapper), so its transaction client is
 * NOT `Prisma.TransactionClient`. reserveSeats only needs $executeRaw, so ask for
 * exactly that, it then works with the extended client, a plain client, or a mock.
 */
type SeatTx = Pick<typeof prisma, "$executeRaw">;

/**
 * Seat accounting for a school licence.
 *
 * Seats are bought PER TERM, so a term's seats are the enrollments in that term's
 * classes, not a school-wide count.
 */

/**
 * Atomically claim `count` seats on a licence.
 *
 * The limit is checked IN the UPDATE's WHERE clause, so the check and the increment
 * are a single statement. This is what makes over-seating impossible: a
 * read-then-write ("count the seats, then decide") is a TOCTOU race, two concurrent
 * roster imports can both read `seatsUsed = 8` against a limit of 10, both conclude
 * they have room for 5, and both write. The DB is the only place that can arbitrate.
 *
 * Returns false when the claim would exceed the seat limit; the caller must then abort
 * (inside its transaction, so nothing is half-written).
 *
 * MUST be called with a transaction client so the seat claim and the enrollments it
 * pays for commit or roll back together.
 */
export async function reserveSeats(
  tx: SeatTx,
  licenseId: string,
  count: number,
): Promise<boolean> {
  if (count <= 0) return true;

  const claimed = await tx.$executeRaw`
    UPDATE "SchoolLicense"
       SET "seatsUsed" = "seatsUsed" + ${count},
           "updatedAt" = NOW()
     WHERE "id" = ${licenseId}
       AND "status" = ${SchoolLicenseStatus.ACTIVE}::"SchoolLicenseStatus"
       AND "seatsUsed" + ${count} <= "seatLimit"
  `;

  // 0 rows updated ⇒ the licence is inactive, gone, or the claim would over-seat.
  return claimed === 1;
}

/**
 * Recompute a session's `seatsUsed` from the enrollments that actually exist in that session's
 * classes, and write it to every term-licence of the session. Drift repair. `reserveSeats` is the
 * authoritative path, but a student removed outside it (or a legacy row) would leave the counter
 * stale.
 *
 * The cohort of a session occupies the same seat count in each of its term-licences (a pupil is
 * taught every term they are licensed for), so all term-licences of the session get the same figure.
 */
export async function reconcileSeats(schoolId: string, sessionLabel: string): Promise<number> {
  // A session's seats = ACTIVE students in classes belonging to that session.
  //
  // `status: "ACTIVE"` is load-bearing. Without it a DROPPED pupil still occupies a seat forever,
  // so a school that deactivates a leaver can never reuse the seat it is still paying for, and the
  // licence counter drifts permanently away from reality.
  const seatsUsed = await prisma.enrollment.count({
    where: { schoolId, schoolClass: { sessionLabel }, status: "ACTIVE" },
  });

  await prisma.schoolLicense.updateMany({
    where: { schoolId, sessionLabel },
    data: { seatsUsed },
  });

  return seatsUsed;
}

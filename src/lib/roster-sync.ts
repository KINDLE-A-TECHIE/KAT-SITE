import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { CourseAudience, UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { PROGRAM_AVAILABLE } from "./program";
import { splitName, syntheticStudentEmail } from "./roster";
import { checkClassLicense } from "./school-license";
import { reconcileSeats, reserveSeats } from "./school-seats";

/**
 * THE one path that creates a school's children.
 *
 * Extracted from the CSV import route so the public v1 roster endpoint and the admin CSV upload run
 * the SAME code. Two code paths that create child accounts would eventually disagree about seat
 * limits, idempotency, or the SCHOOL_STUDENT role, and the one that drifted would be the one
 * nobody tested.
 *
 * CALLERS MUST HAVE AUTHORIZED ALREADY. Nothing here checks who you are; `schoolId` is expected to
 * be derived from a session or an API key, never from a request.
 */

export class OverSeatedError extends Error {
  constructor() {
    super("OVER_SEATED");
  }
}

/** A pupil to place on a class roster. `externalRef` is the school's own opaque id. */
export type RosterCandidate = {
  /** Caller's row/index, used only to report errors without echoing a child's name. */
  ref: string | number;
  name: string;
  externalRef?: string;
  guardianEmail?: string;
  /**
   * The pupil's EXISTING account email, when the caller already holds the exact user (e.g. a session
   * rollover moving pupils to next year's class). Overrides the name-derived synthetic email, so an
   * existing child is matched EXACTLY rather than re-derived, a "Last, First" name would otherwise
   * round-trip to a different synthetic email and create a duplicate child.
   */
  email?: string;
};

export type SyncError = { ref: string | number; reason: string };

export type SyncResult = {
  created: number;
  reactivated: number;
  skipped: number;
  deactivated: number;
  errors: SyncError[];
  seatsUsed: number;
  seatLimit: number;
};

/** Resolves the SCHOOL programme a class enrols into. */
export async function resolveClassProgram(schoolClass: {
  programId: string | null;
  nerdcLevel: string;
}): Promise<{ id: string } | { error: string }> {
  if (schoolClass.programId) {
    const program = await prisma.program.findFirst({
      where: { id: schoolClass.programId, audience: CourseAudience.SCHOOL },
      select: { id: true },
    });
    return program ?? { error: "The class's course no longer exists." };
  }

  // A NERDC level now has one course PER CLASS YEAR (Primary 4/5/6 all sit under PRIMARY_4_6).
  // Picking "the first" would silently enrol a Primary 4 class into the Primary 6 course. Only
  // AVAILABLE (published, live) courses are auto-pickable, so a draft can never be silently chosen.
  const candidates = await prisma.program.findMany({
    where: {
      audience: CourseAudience.SCHOOL,
      nerdcLevel: schoolClass.nerdcLevel as never,
      ...PROGRAM_AVAILABLE,
    },
    select: { id: true },
    take: 2,
  });
  if (candidates.length > 1) {
    return {
      error:
        "This class has no course assigned, and more than one course exists for its level. Assign the class its course first.",
    };
  }
  if (candidates.length === 0) {
    return { error: "No school curriculum exists for this class's level." };
  }
  return candidates[0];
}

/**
 * Places candidates on a class roster.
 *
 * Idempotent: a pupil already on this class is SKIPPED, not duplicated. A pupil of the same name
 * already enrolled in a DIFFERENT class is an ERROR, never a silent move, that ambiguity could be
 * a class change or two different children who share a name, and merging two children is far worse
 * than refusing.
 *
 * `deactivateMissing` marks pupils absent from `candidates` as DROPPED. It NEVER deletes: SCIM and
 * OneRoster both deactivate rather than delete, and for good reason, a deleted child takes their
 * progress, their certificates and their history with them.
 */
export async function syncRoster(params: {
  schoolId: string;
  schoolClassId: string;
  candidates: RosterCandidate[];
  organizationId?: string | null;
  deactivateMissing?: boolean;
  /** Required to deactivate more than DEACTIVATION_THRESHOLD of the roster. */
  force?: boolean;
}): Promise<SyncResult | { error: string; status: number }> {
  const { schoolId, schoolClassId, candidates, organizationId, deactivateMissing, force } = params;

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: schoolClassId, schoolId },
    select: { id: true, nerdcLevel: true, programId: true, sessionLabel: true },
  });
  if (!schoolClass) return { error: "Class not found.", status: 404 };

  const program = await resolveClassProgram(schoolClass);
  if ("error" in program) return { error: program.error, status: 422 };

  const errors: SyncError[] = [];

  // Deduplicate within the payload itself.
  const seen = new Map<string, string | number>();
  const usable: Array<RosterCandidate & { email: string }> = [];
  for (const c of candidates) {
    // A caller that already holds the exact pupil passes their account email; otherwise derive it
    // deterministically from the name. Either way `usable` carries a stable email key.
    const email = c.email ?? syntheticStudentEmail(schoolId, c.name);
    const first = seen.get(email);
    if (first !== undefined) {
      errors.push({ ref: c.ref, reason: `Duplicate of ${first} in this request.` });
      continue;
    }
    seen.set(email, c.ref);
    usable.push({ ...c, email });
  }

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: usable.map((c) => c.email) } },
    select: { id: true, email: true },
  });
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  const existingEnrollments = await prisma.enrollment.findMany({
    where: { schoolId, programId: program.id, userId: { in: [...userByEmail.values()] } },
    select: { id: true, userId: true, schoolClassId: true, status: true },
  });
  const enrollmentByUser = new Map(existingEnrollments.map((e) => [e.userId, e]));

  const toCreate: Array<RosterCandidate & { email: string }> = [];
  /*
   * REACTIVATION. A pupil who was deactivated and later reappears in a sync must come BACK.
   *
   * Without this, `deactivate_missing` is a one-way door: a pupil dropped by an erroneous sync could
   * never be restored through the API, because the next sync would see an enrollment on the right
   * class and quietly skip them, leaving a real, present child marked DROPPED forever. A school
   * would have to call us to undo their own mistake.
   */
  const toReactivate: string[] = [];
  let skipped = 0;

  for (const c of usable) {
    const userId = userByEmail.get(c.email);
    const enrollment = userId ? enrollmentByUser.get(userId) : undefined;

    if (!enrollment) {
      toCreate.push(c);
    } else if (enrollment.schoolClassId === schoolClassId) {
      if (enrollment.status === "ACTIVE") {
        skipped += 1; // already on this roster, a clean re-sync
      } else {
        toReactivate.push(enrollment.id);
      }
    } else {
      errors.push({
        ref: c.ref,
        reason:
          "A student with this name is already enrolled in another class. Rename to disambiguate, or move them manually.",
      });
    }
  }

  // Seats are bought PER TERM within a session; the gate resolves this class's session to its
  // current term-licence, the one that pays for these pupils, not "whichever licence happens to be
  // active".
  const gate = await checkClassLicense(schoolId, schoolClass.sessionLabel);
  if (!gate.allowed) return { error: gate.reason, status: 422 };
  const licence = gate.license;

  // A friendly early rejection. NOT the enforcement, reserveSeats below is, atomically, inside the
  // transaction. Checking here and writing later would be a TOCTOU race.
  // A REACTIVATED pupil takes a seat exactly like a new one, they are a child sitting in the class.
  const seatsNeeded = toCreate.length + toReactivate.length;
  if (licence.seatsUsed + seatsNeeded > licence.seatLimit) {
    return {
      error: `Not enough seats for ${schoolClass.sessionLabel}: ${licence.seatsUsed} of ${licence.seatLimit} in use, and this needs ${seatsNeeded} more. Nothing was changed.`,
      status: 422,
    };
  }

  // ── Deactivation, and the safety valve ──────────────────────────────────────
  let toDeactivate: string[] = [];
  if (deactivateMissing) {
    const onRoster = await prisma.enrollment.findMany({
      where: { schoolId, schoolClassId, status: "ACTIVE" },
      select: { id: true, user: { select: { email: true } } },
    });
    const keep = new Set(usable.map((c) => c.email));
    toDeactivate = onRoster.filter((e) => !keep.has(e.user.email)).map((e) => e.id);

    /*
     * THE SAFETY VALVE. Clever halts a sync when too large a share of a school's students would
     * disappear, and that behaviour exists because it has already gone wrong for somebody.
     *
     * The realistic failure is not malice. It is a school's IT contractor running a sync against a
     * half-populated staging export at 4pm on a Friday, and unenrolling a year group. So a large
     * deactivation must be stated twice.
     */
    if (
      onRoster.length > 0 &&
      toDeactivate.length / onRoster.length > DEACTIVATION_THRESHOLD &&
      !force
    ) {
      return {
        error: `This would deactivate ${toDeactivate.length} of ${onRoster.length} pupils on the class. That is more than ${Math.round(
          DEACTIVATION_THRESHOLD * 100,
        )}% of the roster, if you meant it, send "force": true. Nothing was changed.`,
        status: 409,
      };
    }
  }

  const unusablePassword = await bcrypt.hash(crypto.randomBytes(24).toString("base64"), 12);

  // BULK writes. A row-at-a-time loop of upserts issues ~4 round-trips per child, which blows
  // Prisma's interactive-transaction timeout on a 500-pupil roster.
  await prisma.$transaction(
    async (tx) => {
      const newStudents = toCreate
        .filter((c) => !userByEmail.has(c.email))
        .map((c) => {
          const { firstName, lastName } = splitName(c.name);
          return {
            email: c.email,
            passwordHash: unusablePassword, // unusable until a password is set
            firstName,
            lastName,
            // SCHOOL_STUDENT, never STUDENT. A global STUDENT is a B2C learner, visible in every
            // KAT instructor's contact picker and messageable by them.
            role: UserRole.SCHOOL_STUDENT,
            organizationId: organizationId ?? undefined,
            isActive: true,
          };
        });
      if (newStudents.length > 0) {
        await tx.user.createMany({ data: newStudents, skipDuplicates: true });
      }

      const students = await tx.user.findMany({
        where: { email: { in: toCreate.map((c) => c.email) } },
        select: { id: true, email: true },
      });
      const idByEmail = new Map(students.map((s) => [s.email, s.id]));

      await tx.enrollment.createMany({
        data: toCreate.flatMap((c) => {
          const userId = idByEmail.get(c.email);
          return userId
            ? [
                {
                  userId,
                  programId: program.id,
                  schoolId,
                  schoolClassId,
                  externalRef: c.externalRef ?? null,
                },
              ]
            : [];
        }),
        skipDuplicates: true,
      });

      // Guardians. No email is sent; the account is unusable until they set a password.
      const guardianEmails = [
        ...new Set(toCreate.map((c) => c.guardianEmail).filter((e): e is string => Boolean(e))),
      ];
      if (guardianEmails.length > 0) {
        await tx.user.createMany({
          data: guardianEmails.map((email) => ({
            email,
            passwordHash: unusablePassword,
            firstName: "Guardian",
            lastName: "",
            role: UserRole.PARENT,
            organizationId: organizationId ?? undefined,
            isActive: true,
          })),
          skipDuplicates: true,
        });

        const guardians = await tx.user.findMany({
          where: { email: { in: guardianEmails } },
          select: { id: true, email: true },
        });
        const guardianIdByEmail = new Map(guardians.map((g) => [g.email, g.id]));

        await tx.parentStudent.createMany({
          data: toCreate.flatMap((c) => {
            if (!c.guardianEmail) return [];
            const childId = idByEmail.get(c.email);
            const parentId = guardianIdByEmail.get(c.guardianEmail);
            return parentId && childId ? [{ parentId, childId }] : [];
          }),
          skipDuplicates: true,
        });
      }

      // Bring back anyone who was dropped and has reappeared.
      if (toReactivate.length > 0) {
        await tx.enrollment.updateMany({
          where: { id: { in: toReactivate }, schoolId },
          data: { status: "ACTIVE" },
        });
      }

      // DEACTIVATE, never delete. A deleted child takes their progress, certificates and history
      // with them; a DROPPED one comes back with tomorrow's sync.
      if (toDeactivate.length > 0) {
        await tx.enrollment.updateMany({
          where: { id: { in: toDeactivate }, schoolId },
          data: { status: "DROPPED" },
        });
      }

      // THE enforcement: one atomic UPDATE with the limit in its WHERE clause, so two concurrent
      // syncs cannot both squeeze past it. Failing here aborts the transaction, so a sync never
      // half-lands.
      const reserved = await reserveSeats(tx, licence.id, seatsNeeded);
      if (!reserved) throw new OverSeatedError();
    },
    { timeout: 20_000, maxWait: 10_000 },
  );

  // Deactivation frees the seat. reserveSeats only ever INCREMENTS (it is the atomic race guard), so
  // without this reconciliation licence.seatsUsed drifts upward forever and a school eventually
  // cannot enrol into seats it is paying for and not using.
  const seatsUsed = await reconcileSeats(schoolId, schoolClass.sessionLabel);

  return {
    created: toCreate.length,
    reactivated: toReactivate.length,
    skipped,
    deactivated: toDeactivate.length,
    errors,
    seatsUsed,
    seatLimit: licence.seatLimit,
  };
}

/** Above this share of a class roster, a deactivation must be confirmed with `force`. */
export const DEACTIVATION_THRESHOLD = 0.2;

import { NextResponse } from "next/server";
import { z } from "zod";
import { SchoolApiScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  apiError,
  apiOk,
  authorizeV1,
  checkIdempotency,
  saveIdempotency,
} from "@/lib/api-v1";
import { OverSeatedError, syncRoster, type RosterCandidate } from "@/lib/roster-sync";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/v1/roster, sync a class roster from the school's own pupil-records system.
 *
 * (Schools call that an MIS, an SMS. School Management System, or an SIS, depending on where they
 * trained. Avoid the abbreviations in anything a Nigerian reader sees: "SMS" reads as text
 * messaging to essentially everyone here.)
 *
 * The single highest-blast-radius endpoint we expose: it CREATES CHILD ACCOUNTS. It therefore needs
 * the explicit ROSTER_WRITE scope, which a read-only reporting key does not have.
 *
 * It shares src/lib/roster-sync.ts with the admin CSV importer. One code path creates children;
 * one seat check; one idempotency rule.
 *
 * DEACTIVATION, NOT DELETION. `deactivateMissing` marks absent pupils DROPPED. SCIM and OneRoster
 * both deactivate rather than delete, because a deleted child takes their progress, certificates
 * and history with them. And a large deactivation must be stated twice (`force`), because the
 * realistic failure is not malice: it is a contractor syncing a half-populated staging export at
 * 4pm on a Friday and unenrolling a year group.
 *
 * NO PII IN THE URL: names and refs travel in the BODY.
 */

const studentSchema = z.object({
  /** The school's own opaque pupil id. Their key for every other endpoint. */
  student_id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(2).max(120),
  guardian_email: z.string().trim().email().max(200).toLowerCase().optional(),
});

const bodySchema = z.object({
  class_id: z.string().trim().min(1).max(64),
  students: z.array(studentSchema).min(1).max(500),
  /** Mark pupils absent from `students` as DROPPED. Off by default: a shorter payload must never
   *  silently unenrol children. */
  deactivate_missing: z.boolean().optional().default(false),
  /** Required to deactivate more than 20% of a class. */
  force: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const auth = await authorizeV1(request, SchoolApiScope.ROSTER_WRITE);
  if (auth instanceof NextResponse) return auth;
  const { schoolId } = auth.caller;

  // Read the body ONCE, as text: idempotency hashes the exact bytes, and a Request body can only be
  // consumed a single time.
  const rawBody = await request.text();

  const idem = await checkIdempotency(request, schoolId, rawBody);
  if (idem.replayed) return idem.response;

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError("Invalid JSON.", 400, "invalid_json");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid payload.", 400, "invalid_payload");
  }
  const { class_id, students, deactivate_missing, force } = parsed.data;

  try {
    // TENANT ISOLATION: the class is read through the KEY's schoolId. Another school's class id is
    // simply not found, it does not exist to this caller.
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: class_id, schoolId },
      select: { id: true },
    });
    if (!schoolClass) return apiError("Class not found.", 404, "not_found");

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { memberships: { take: 1, select: { user: { select: { organizationId: true } } } } },
    });
    const organizationId = school?.memberships[0]?.user.organizationId ?? null;

    const candidates: RosterCandidate[] = students.map((s) => ({
      // Errors are reported against the school's OWN id, so no child's name is echoed back into
      // their logs.
      ref: s.student_id,
      name: s.name,
      externalRef: s.student_id,
      guardianEmail: s.guardian_email,
    }));

    const result = await syncRoster({
      schoolId,
      schoolClassId: class_id,
      candidates,
      organizationId,
      deactivateMissing: deactivate_missing,
      force,
    });

    if ("error" in result) return apiError(result.error, result.status, "sync_refused");

    const payload = {
      created: result.created,
      // A pupil who was dropped and has reappeared. Reported separately from `created`: a school
      // reconciling its own numbers must be able to tell a new child from a returning one.
      reactivated: result.reactivated,
      skipped: result.skipped,
      deactivated: result.deactivated,
      errors: result.errors.map((e) => ({ student_id: String(e.ref), reason: e.reason })),
      seats: { used: result.seatsUsed, limit: result.seatLimit },
    };

    await saveIdempotency(schoolId, idem.key, idem.bodyHash, 200, payload);
    return apiOk(payload);
  } catch (error) {
    if (error instanceof OverSeatedError) {
      return apiError(
        "Not enough seats remain for this term. Nothing was changed.",
        422,
        "over_seated",
      );
    }
    captureError(error);
    return apiError("Could not sync the roster.", 500, "internal_error");
  }
}

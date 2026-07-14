import { SchoolRole } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { getServerAuthSession } from "@/lib/auth";
import { requireActiveSchool } from "@/lib/school";
import { parseCsvWithHeader } from "@/lib/csv";
import { rosterImportSchema, rosterRowSchema, ROSTER_MAX_ROWS } from "@/lib/validators";
import { OverSeatedError, syncRoster, type RosterCandidate } from "@/lib/roster-sync";
import { trackEvent } from "@/lib/analytics";
import { captureError } from "@/lib/sentry";

/**
 * POST /api/school/roster/import, bulk-create students for one class from CSV.
 *
 * This route now only PARSES. Child creation, seat reservation and idempotency live in
 * src/lib/roster-sync.ts, shared with the public v1 roster endpoint. Two code paths that create
 * child accounts would eventually disagree about seat limits or the SCHOOL_STUDENT role, and the
 * one that drifted would be the one nobody tested.
 *
 * PRIVACY: the CSV arrives in the request BODY, is parsed in memory, and is never written to disk
 * or a URL. Errors are reported by ROW NUMBER; telemetry carries counts only.
 *
 * TENANT ISOLATION: schoolId comes from the session, never the request.
 */

/** Accepted header spellings. */
const NAME_KEYS = ["name", "student", "student name", "full name"];
const GUARDIAN_KEYS = ["guardian email", "guardianemail", "guardian", "parent email", "email"];
/** The school's own pupil id, optional; the handle the embed and the v1 API use to name a child. */
const REF_KEYS = ["student_id", "student id", "studentid", "ref", "reference", "admission number"];

function guardFail(error: unknown) {
  const message = error instanceof Error ? error.message : "Forbidden";
  return message === "Unauthorized" ? fail("Unauthorized", 401) : fail("Forbidden", 403);
}

export async function POST(request: Request) {
  let schoolId: string;
  try {
    ({ schoolId } = await requireActiveSchool([SchoolRole.SCHOOL_ADMIN]));
  } catch (error) {
    return guardFail(error);
  }

  const session = await getServerAuthSession();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = rosterImportSchema.safeParse(body);
  if (!parsed.success) {
    return fail("Invalid import payload.", 400, parsed.error.flatten());
  }
  const { schoolClassId, csv } = parsed.data;

  try {
    const { headers, rows } = parseCsvWithHeader(csv);
    const nameKey = NAME_KEYS.find((k) => headers.includes(k));
    if (!nameKey) return fail("CSV must have a 'name' column.", 422);

    const guardianKey = GUARDIAN_KEYS.find((k) => headers.includes(k));
    const refKey = REF_KEYS.find((k) => headers.includes(k));

    if (rows.length === 0) return fail("The CSV has no data rows.", 422);
    if (rows.length > ROSTER_MAX_ROWS) {
      return fail(`Too many rows, the limit is ${ROSTER_MAX_ROWS} per import.`, 422);
    }

    const parseErrors: Array<{ row: number; reason: string }> = [];
    const candidates: RosterCandidate[] = [];

    rows.forEach((record, i) => {
      const rowNo = i + 2; // +1 zero-index, +1 header line
      const result = rosterRowSchema.safeParse({
        name: record[nameKey],
        guardianEmail: guardianKey ? record[guardianKey] : undefined,
        externalRef: refKey ? record[refKey] : undefined,
      });

      if (!result.success) {
        parseErrors.push({
          row: rowNo,
          reason: result.error.issues.map((issue) => issue.message).join(" "),
        });
        return;
      }

      candidates.push({
        ref: rowNo,
        name: result.data.name,
        guardianEmail: result.data.guardianEmail,
        externalRef: result.data.externalRef,
      });
    });

    // The CSV importer NEVER deactivates. Removing a child must be a deliberate act, not a
    // consequence of uploading a shorter spreadsheet.
    const result = await syncRoster({
      schoolId,
      schoolClassId,
      candidates,
      organizationId: session?.user?.organizationId,
    });

    if ("error" in result) return fail(result.error, result.status);

    await trackEvent({
      userId: session?.user?.id,
      eventType: "admin",
      eventName: "school_roster_imported",
      // Counts only, never a child's name.
      payload: {
        schoolId,
        schoolClassId,
        created: result.created,
        skipped: result.skipped,
        errors: result.errors.length + parseErrors.length,
      },
    });

    // Response shape unchanged, roster-import-panel.tsx reads `seats: { used, limit }`.
    const errors = [
      ...parseErrors, ...result.errors.map((e) => ({ row: Number(e.ref), reason: e.reason })),
    ].sort((a, b) => a.row - b.row);

    return ok({
      created: result.created,
      skipped: result.skipped,
      errors,
      seats: { used: result.seatsUsed, limit: result.seatLimit },
    });
  } catch (error) {
    // Lost the seat race against a concurrent import, a business rule, not a fault. Nothing was
    // written: the reservation failure rolled the transaction back.
    if (error instanceof OverSeatedError) {
      return fail(
        "Not enough seats remaining, another import claimed them first. Nothing was imported.",
        422,
      );
    }
    captureError(error);
    return fail("Could not import the roster.", 500);
  }
}

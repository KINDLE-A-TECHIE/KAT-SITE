/**
 * School session/term helpers.
 *
 * A school runs an academic SESSION (e.g. "2025/2026") made of three TERMS (1, 2, 3). A class is a
 * cohort for a session; a licence is bought per (session, term). This module is the single place that
 * parses the old free-text term strings, formats a term for display, and computes a term's window.
 *
 * TERM LENGTH IS FIXED: every term ends exactly 15 weeks after its admin-entered start date, so the
 * end is always DERIVED from the start (one source of truth, no way to enter a bad end date).
 */

/** Fixed term length. Change here if the academic term length ever changes. */
export const TERM_LENGTH_WEEKS = 15;

/**
 * Grace period after a term's nominal end. Access CONTINUES through grace (a late renewal must not
 * strand pupils mid-work), but the licence is flagged as lapsing and the admin is nagged to renew.
 * Access stops only once grace is over.
 */
export const TERM_GRACE_WEEKS = 2;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TERM_LENGTH_MS = TERM_LENGTH_WEEKS * WEEK_MS;
const TERM_GRACE_MS = TERM_GRACE_WEEKS * WEEK_MS;

export type ParsedTerm = { sessionLabel: string; termNumber: number };

/**
 * Parse a legacy free-text term ("2025/2026 Term 1", "2025/2026 t2", "JSS Term 3") into a
 * structured { sessionLabel, termNumber }.
 *
 * termNumber is the 1..3 digit after "term"/"t"; it defaults to 1 when absent. sessionLabel is
 * whatever remains once the term marker is removed (falling back to the whole trimmed string). This
 * mirrors the migration backfill, so re-parsing anywhere agrees with the migrated columns.
 */
export function parseTerm(raw: string): ParsedTerm {
  const input = raw.trim();
  const match = input.match(/\b(?:term|t)\s*([1-3])\b/i);
  const termNumber = match ? Number(match[1]) : 1;

  let sessionLabel = input;
  if (match) {
    sessionLabel = (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length))
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!sessionLabel) {
    sessionLabel = input.replace(/\s+/g, " ").trim();
  }
  return { sessionLabel, termNumber };
}

/** Human label for a term, e.g. "2025/2026 Term 1". */
export function formatTerm(sessionLabel: string, termNumber: number): string {
  return `${sessionLabel} Term ${termNumber}`;
}

/**
 * A module IS a term: Module.sortOrder is 0-based (the NERDC seed sets `sortOrder = unit.order - 1`),
 * so Term 1 is sortOrder 0. The term number a module belongs to is therefore sortOrder + 1. This is
 * the single place that mapping lives, so per-module licensing everywhere agrees.
 */
export function termNumberForModule(sortOrder: number): number {
  return sortOrder + 1;
}

/**
 * Forgiving compare key for a session label, so "2025/2026" matches "2025/2026 " and "2025/2026".
 * Session labels are admin-typed free text, so a stray case/space difference must not lock a school
 * out of a class it paid for. Mirrors the old normalizeTerm compare.
 */
export function normalizeSession(sessionLabel: string): string {
  return sessionLabel.trim().toLowerCase().replace(/\s+/g, " ");
}

/** A term's NOMINAL end = start + 15 weeks. Null start means no known window. */
export function termEndsAt(startsAt: Date | null | undefined): Date | null {
  return startsAt ? new Date(startsAt.getTime() + TERM_LENGTH_MS) : null;
}

/** The hard access cutoff = nominal end + grace. After this, access is refused. */
export function termGraceEndsAt(startsAt: Date | null | undefined): Date | null {
  return startsAt ? new Date(startsAt.getTime() + TERM_LENGTH_MS + TERM_GRACE_MS) : null;
}

/**
 * Is `now` inside a term's ACCESS window? Access runs from the start until the END OF GRACE, so a
 * school in its grace period keeps working while the admin renews. A null start means the term has no
 * date yet (legacy or not-yet-scheduled), treated as "no time limit" so access does not depend on
 * data we never captured.
 */
export function isWithinTermWindow(startsAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!startsAt) return true;
  const graceEnd = termGraceEndsAt(startsAt)!;
  return now >= startsAt && now < graceEnd;
}

export type TermLifecycle = "UNLIMITED" | "NOT_STARTED" | "ACTIVE" | "GRACE" | "EXPIRED";

/**
 * Where a term sits in its lifecycle right now. UNLIMITED = no start captured; NOT_STARTED = starts
 * in the future; ACTIVE = inside the 15 weeks; GRACE = past the end but still inside grace; EXPIRED =
 * past grace. Used for banners, the expiry cron, and status reconciliation.
 */
export function termLifecycle(startsAt: Date | null | undefined, now: Date = new Date()): TermLifecycle {
  if (!startsAt) return "UNLIMITED";
  if (now < startsAt) return "NOT_STARTED";
  if (now < termEndsAt(startsAt)!) return "ACTIVE";
  if (now < termGraceEndsAt(startsAt)!) return "GRACE";
  return "EXPIRED";
}

/**
 * Whole days from `now` until the term's NOMINAL end (positive = days left; negative = days into
 * grace/expiry). Null when there is no start date. Drives the "expires in N days" copy.
 */
export function daysUntilTermEnds(startsAt: Date | null | undefined, now: Date = new Date()): number | null {
  if (!startsAt) return null;
  return Math.ceil((termEndsAt(startsAt)!.getTime() - now.getTime()) / DAY_MS);
}

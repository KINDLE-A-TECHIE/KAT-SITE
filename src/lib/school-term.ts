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

const TERM_LENGTH_MS = TERM_LENGTH_WEEKS * 7 * 24 * 60 * 60 * 1000;

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

/** A term's end = start + 15 weeks. Null start means no known window. */
export function termEndsAt(startsAt: Date | null | undefined): Date | null {
  return startsAt ? new Date(startsAt.getTime() + TERM_LENGTH_MS) : null;
}

/**
 * Is `now` inside a term's window? A null start means the term has no date yet (legacy or not-yet
 * scheduled), which we treat as "no time limit" so access does not depend on data we never captured.
 */
export function isWithinTermWindow(startsAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!startsAt) return true;
  const end = termEndsAt(startsAt)!;
  return now >= startsAt && now < end;
}

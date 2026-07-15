import crypto from "crypto";

/**
 * Pure helpers for the school roster importer. Kept out of the route handler so
 * they can be unit-tested, getting a child's identity or name wrong is a data
 * -integrity bug, not a cosmetic one.
 */

/** Case/whitespace-insensitive identity for a child within one school. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A child's account email.
 *
 * Children have no email of their own, but User.email is unique + required. We
 * derive a stable, NON-ROUTABLE address from (schoolId, normalized name).
 * `.invalid` is reserved by RFC 2606, so it can never receive mail.
 *
 * Determinism is what makes re-importing the same roster a no-op instead of
 * creating duplicate children.
 */
export function syntheticStudentEmail(schoolId: string, name: string): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${schoolId}|${normalizeName(name)}`)
    .digest("hex")
    .slice(0, 32);
  return `student.${digest}@roster.invalid`;
}

/**
 * Split a roster name into first/last.
 *
 * Handles the conventional "Last, First" form ("Okafor, Chidi"), which is
 * precisely why such names are quoted in a CSV. A naive whitespace split would
 * store the first name as "Okafor," (trailing comma, names reversed).
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = full.trim();

  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    const first = rest.join(",").trim();
    if (first && last.trim()) {
      return { firstName: first, lastName: last.trim() };
    }
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? trimmed,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : "",
  };
}

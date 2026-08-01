/**
 * Display formatting for class join codes. Pure and client-safe (no crypto, no `server-only`), so the
 * admin panel (client) and the printable sign-in cards (server) format a code the same way.
 *
 * Codes are STORED normalized (uppercase, no separator) so a child who types the code with or without
 * the hyphen still matches (see `normalizeJoinCode` in student-pin.ts). The hyphen is display-only: it
 * separates the school prefix from the class number on a printed card, so a child does not misread
 * DEMO01 as DEM-O01.
 */
export function formatJoinCode(code: string): string {
  // Only the "<LETTERS><DIGITS>" scheme gets a hyphen; legacy random codes are left untouched.
  return code.replace(/^([A-Z]{2,})(\d{2,})$/, "$1-$2");
}

/**
 * A short, readable code prefix derived from the school's name: "Demo Academy" -> "DEMO". Uppercase
 * alphanumerics only (a child reads it off a printed card), capped short so the whole code stays easy
 * to type. Falls back to "SCH" for a name with no usable letters. Returns only [A-Z0-9], so it is
 * safe to interpolate into a RegExp (see ensureJoinCode).
 */
export function schoolCodePrefix(schoolName: string): string {
  const cleaned = schoolName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 4) || "SCH";
}

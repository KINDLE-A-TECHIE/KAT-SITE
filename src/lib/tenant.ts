import { SCHOOL_ROLES } from "./roles";

/**
 * Tenant scoping for B2C queries.
 *
 * The school product has had scope discipline from the start: every school-scoped query carries
 * `where: { schoolId }`, and a test enforces it. The B2C side had no equivalent, it relied on an
 * IMPLICIT tenant ("everything that isn't a school"), which nobody filtered on. A boundary that
 * only one side honours is not a boundary. These helpers are the B2C half.
 */

/**
 * A sentinel organization id that matches no row.
 *
 * Why not `undefined`? Because in Prisma, `where: { organizationId: undefined }` does not mean
 * "belongs to no organization", it means the condition is REMOVED. The widespread
 * `organizationId: session.user.organizationId ?? undefined` therefore FAILED OPEN: a user with no
 * organization matched every row in every organization. This makes the same expression fail closed.
 */
export const NO_ORGANIZATION = "__no_organization__";

/**
 * `where` fragment restricting rows to the caller's organization. Fails CLOSED: a caller with no
 * organization matches nothing rather than everything.
 */
export function orgScope(organizationId: string | null | undefined) {
  return { organizationId: organizationId ?? NO_ORGANIZATION };
}

/**
 * `where` fragment for "users of the B2C product".
 *
 * Any query that enumerates PEOPLE across the platform, contact pickers, admin user lists,
 * analytics, must spread this, or a school's children surface in a KAT instructor's directory.
 */
export const b2cUserScope = { role: { notIn: SCHOOL_ROLES } } as const;

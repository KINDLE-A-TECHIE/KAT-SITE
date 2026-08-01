/**
 * Programme lifecycle: Draft (isPublished false) -> Published (true) -> Archived (isActive false).
 *
 * A programme is AVAILABLE to learners and schools (enrollable, assignable, resolvable) only when it
 * is both live and published. Every learner-facing surface must filter on this, spread it into the
 * Prisma `where` so the rule lives in one place and can't drift. The super-admin management view
 * deliberately does NOT use it (it needs to see drafts and archived programmes).
 */
export const PROGRAM_AVAILABLE = { isActive: true, isPublished: true } as const;

export type ProgramLifecycle = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** Derives the display status from the two flags. Archived wins (retirement is terminal). */
export function programLifecycle(p: { isActive: boolean; isPublished: boolean }): ProgramLifecycle {
  if (!p.isActive) return "ARCHIVED";
  return p.isPublished ? "PUBLISHED" : "DRAFT";
}

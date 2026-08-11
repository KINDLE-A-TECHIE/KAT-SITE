/**
 * Per-account capabilities ("need to know") for ADMIN and INSTRUCTOR staff.
 *
 * A role is still a CAPABILITY set (what you MAY do), but within ADMIN/INSTRUCTOR a super-admin can
 * narrow it PER ACCOUNT to a subset of coarse "areas", grouped by department (B2C, B2B, cross-cutting).
 * This is the general form of the existing per-account `canGrantRetakes` flag.
 *
 * SUPER_ADMIN is never restricted. Other roles (STUDENT/FELLOW/PARENT/SCHOOL_*) do not use this, their
 * access is governed by their role and (for schools) SchoolMembership.
 *
 * Pure and dependency-light so both the server (guards) and the client (the editor UI, nav filter)
 * import it. Enforcement in Phase 1 is VIEW-level (nav + page guards); route-level "do" checks follow.
 */

export type Department = "B2C" | "B2B" | "CROSS";

export const CAPABILITY_KEYS = [
  // ── B2C (consumer) ──
  "curriculum",
  "assessments",
  "challenges",
  "projects",
  "sessions",
  "payments",
  "analytics",
  "fellowship",
  "testimonials",
  // ── B2B (schools) ──
  "partner_inquiries",
  "schools",
  // ── Cross-cutting ──
  "messaging",
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export type Capability = {
  key: CapabilityKey;
  label: string;
  department: Department;
  description: string;
};

export const CAPABILITIES: Capability[] = [
  { key: "curriculum", label: "Curriculum & content", department: "B2C", description: "Author lessons, modules, and content; review content." },
  { key: "assessments", label: "Assessments & grading", department: "B2C", description: "Create assessments and grade submissions." },
  { key: "challenges", label: "Challenges", department: "B2C", description: "Manage weekly challenges and their submissions." },
  { key: "projects", label: "Projects", department: "B2C", description: "Review and manage student projects." },
  { key: "sessions", label: "Sessions", department: "B2C", description: "Schedule and host live sessions." },
  { key: "payments", label: "Payments", department: "B2C", description: "View payments, invoices, and receipts." },
  { key: "analytics", label: "Analytics & reports", department: "B2C", description: "View platform analytics and reports." },
  { key: "fellowship", label: "Fellowship & cohorts", department: "B2C", description: "Review fellowship applications and manage cohorts." },
  { key: "testimonials", label: "Testimonials", department: "B2C", description: "Review and feature parent testimonials." },
  { key: "partner_inquiries", label: "Partner inquiries", department: "B2B", description: "Handle school/partner inquiries." },
  { key: "schools", label: "Schools & licensing", department: "B2B", description: "Manage schools, seat pricing, and provisioning." },
  { key: "messaging", label: "Messaging", department: "CROSS", description: "Message students, fellows, and staff." },
];

export const ALL_CAPABILITY_KEYS: CapabilityKey[] = [...CAPABILITY_KEYS];

/** Capabilities grouped by department, for the editor UI. */
export const CAPABILITIES_BY_DEPARTMENT: Record<Department, Capability[]> = {
  B2C: CAPABILITIES.filter((c) => c.department === "B2C"),
  B2B: CAPABILITIES.filter((c) => c.department === "B2B"),
  CROSS: CAPABILITIES.filter((c) => c.department === "CROSS"),
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  B2C: "Consumer (B2C)",
  B2B: "Schools (B2B)",
  CROSS: "Cross-cutting",
};

/** True if the key is a real capability (guards against a typo or a stale key from an old client). */
export function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === "string" && (CAPABILITY_KEYS as readonly string[]).includes(value);
}

type CapabilityUser = { role?: string | null; permissions?: string[] | null };

/**
 * Whether a user may access a capability area. SUPER_ADMIN always may. For ADMIN/INSTRUCTOR it is the
 * per-account grant. Any other role returns false here (they never route through capability areas; use
 * their role/membership guards instead).
 */
export function hasCapability(user: CapabilityUser | null | undefined, key: CapabilityKey): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  if (user.role === "ADMIN" || user.role === "INSTRUCTOR") {
    return (user.permissions ?? []).includes(key);
  }
  return false;
}

/**
 * True when the caller is an ADMIN/INSTRUCTOR who has NOT been granted this area. Returns false for
 * every other role (SUPER_ADMIN, FELLOW, STUDENT, PARENT, ...), whose access to a route is already
 * governed by that route's role check. So capability enforcement LAYERS on top of the role guard: it
 * only ever narrows staff, never widens or blocks anyone the role check already handled.
 */
export function capabilityDenied(user: CapabilityUser | null | undefined, key: CapabilityKey): boolean {
  if (!user) return false;
  return (user.role === "ADMIN" || user.role === "INSTRUCTOR") && !hasCapability(user, key);
}

/**
 * Route guard: throw "Forbidden" (caught by the handler's try/catch like `ensureRole`) when an
 * ADMIN/INSTRUCTOR lacks the area. Call it AFTER the existing role check. No-op for other roles.
 */
export function ensureCapability(user: CapabilityUser | null | undefined, key: CapabilityKey): void {
  if (capabilityDenied(user, key)) {
    throw new Error("Forbidden");
  }
}

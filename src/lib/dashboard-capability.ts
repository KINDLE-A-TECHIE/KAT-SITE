import "server-only";
import { redirect } from "next/navigation";
import { hasCapability, type CapabilityKey } from "./capabilities";

/**
 * View-gating guard for a dashboard page. Redirects an ADMIN/INSTRUCTOR who lacks a capability area
 * back to the Overview, so a restricted account cannot deep-link to a page hidden from their nav.
 *
 * SUPER_ADMIN and every other role fall through untouched, their own page guards still apply. Call it
 * AFTER the page's existing auth/role check, near the top of the server component.
 */
export function guardDashboardCapability(
  user: { role: string; permissions?: string[] | null } | undefined | null,
  cap: CapabilityKey,
): void {
  if (!user) return;
  if ((user.role === "ADMIN" || user.role === "INSTRUCTOR") && !hasCapability(user, cap)) {
    redirect("/dashboard");
  }
}

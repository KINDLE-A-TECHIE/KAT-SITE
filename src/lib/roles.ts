import type { UserRoleValue } from "./enums";

export const EMPLOYEE_ROLES: UserRoleValue[] = [
  "ADMIN",
  "INSTRUCTOR",
  "FELLOW",
];

export const ADMIN_ROLES: UserRoleValue[] = ["SUPER_ADMIN", "ADMIN"];

export const INSTRUCTION_ROLES: UserRoleValue[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "INSTRUCTOR",
];

/**
 * Accounts that belong to the school (B2B) product and hold NO B2C capability.
 *
 * Deliberately absent from every list above. A school admin's authority comes from her
 * SchoolMembership, not her global role, so the role should grant nothing. She was previously given
 * INSTRUCTOR, which could message any student in the organization and read their submissions.
 */
export const SCHOOL_ROLES: UserRoleValue[] = ["SCHOOL_STAFF", "SCHOOL_STUDENT"];

export const DASHBOARD_ROUTES: Record<UserRoleValue, string> = {
  SUPER_ADMIN: "/dashboard",
  ADMIN: "/dashboard",
  INSTRUCTOR: "/dashboard",
  FELLOW: "/dashboard",
  STUDENT: "/dashboard",
  PARENT: "/dashboard",
  // School accounts live on the school host. /dashboard is the B2C surface and has nothing for them.
  SCHOOL_STAFF: "/home",
  SCHOOL_STUDENT: "/learn",
};

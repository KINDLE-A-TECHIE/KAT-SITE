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

export const DASHBOARD_ROUTES: Record<UserRoleValue, string> = {
  SUPER_ADMIN: "/dashboard",
  ADMIN: "/dashboard",
  INSTRUCTOR: "/dashboard",
  FELLOW: "/dashboard",
  STUDENT: "/dashboard",
  PARENT: "/dashboard",
};

import type { SchoolRole, UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      organizationId: string | null;
      firstName: string;
      lastName: string;
      sessionToken?: string;
      /**
       * The user's school memberships, re-read from the DB on every request.
       *
       * DELIBERATELY ABSENT FROM THE JWT. Revoking a teacher must take effect immediately: this is
       * the tenant boundary for children's data, and a 30-day JWT would have kept a removed teacher
       * inside a school for weeks.
       */
      schoolMemberships?: Array<{ schoolId: string; role: SchoolRole }>;
      activeSchoolId?: string | null;
      /**
       * Per-account capability areas for ADMIN/INSTRUCTOR (keys from src/lib/capabilities.ts).
       * Re-read from the DB every request like schoolMemberships, NOT from the JWT, so a super-admin
       * narrowing an account takes effect on the next request rather than after a 30-day token expiry.
       */
      permissions?: string[];
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    organizationId?: string | null;
    firstName?: string;
    lastName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    organizationId?: string | null;
    firstName?: string;
    lastName?: string;
    sessionId?: string;
  }
}

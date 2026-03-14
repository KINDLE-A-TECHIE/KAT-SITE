import type { UserRole } from "@prisma/client";
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

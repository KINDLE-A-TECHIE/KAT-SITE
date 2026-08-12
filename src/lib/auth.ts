import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "./prisma";
import { ensureDefaultOrganization } from "./default-organization";
import { loginSchema } from "./validators";
import { trackEvent } from "./analytics";
import { loginLimiter } from "./ratelimit";
import { verifyTurnstile } from "./turnstile";
import { redeemStudentLaunch } from "./student-launch";
import { authorizeStudentPin } from "./student-pin";
import { cache } from "react";

/** The user shape every provider's authorize() must return, so the jwt callback can read it. */
function sessionUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  organizationId: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    organizationId: user.organizationId ?? undefined,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

/**
 * A user's school memberships. `cache()` dedupes this within a single request, so the session
 * callback firing several times in one render does not become several queries.
 */
const getSchoolMemberships = cache(async (userId: string) =>
  prisma.schoolMembership.findMany({
    where: { userId },
    select: { schoolId: true, role: true },
  }),
);

// Per-account ADMIN/INSTRUCTOR capability areas, re-read every request (like memberships), so a
// super-admin narrowing an account takes effect immediately rather than after the JWT expires.
const getUserPermissions = cache(async (userId: string): Promise<string[]> => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true } });
  return user?.permissions ?? [];
});

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile Token", type: "text" },
      },
      async authorize(credentials) {
        const turnstileOk = await verifyTurnstile(credentials?.turnstileToken);
        if (!turnstileOk) throw new Error("Bot verification failed. Please refresh and try again.");

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        if (loginLimiter) {
          const { success } = await loginLimiter.limit(parsed.data.email.toLowerCase());
          if (!success) {
            throw new Error("Too many login attempts. Please try again in 15 minutes.");
          }
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordMatches) {
          return null;
        }

        let organizationId = user.organizationId;
        if (!organizationId) {
          const defaultOrganization = await ensureDefaultOrganization();
          await prisma.user.update({
            where: { id: user.id },
            data: { organizationId: defaultOrganization.id },
          });
          organizationId = defaultOrganization.id;
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          organizationId,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),

    // School pupils have no email/password. They sign in one of two ways, each a
    // dedicated provider so the email/password path stays untouched.

    // Option A: a teacher who owns the pupil's class minted a 60s single-use launch
    // token; the pupil's device redeems it here. Authority was proved at mint time.
    CredentialsProvider({
      id: "student-launch",
      name: "Student launch",
      credentials: { token: { label: "Launch token", type: "text" } },
      async authorize(credentials) {
        const token = credentials?.token;
        if (!token) return null;
        const result = await redeemStudentLaunch(token);
        if (!result.ok) throw new Error(result.reason);
        const user = await prisma.user.findUnique({
          where: { id: result.userId },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, isActive: true },
        });
        // Only ever a SCHOOL_STUDENT: the token redeemer already checked the enrollment, but this
        // is the line that guarantees this provider can never mint a session for a staff/B2C account.
        if (!user || !user.isActive || user.role !== UserRole.SCHOOL_STUDENT) return null;
        return sessionUser(user);
      },
    }),

    // Option B: class code + pupil PIN, for schools with no system to launch from.
    CredentialsProvider({
      id: "student-pin",
      name: "Student PIN",
      credentials: {
        classCode: { label: "Class code", type: "text" },
        pupilRef: { label: "Pupil", type: "text" },
        pin: { label: "PIN", type: "password" },
      },
      async authorize(credentials) {
        const result = await authorizeStudentPin(credentials);
        if (!result.ok) throw new Error(result.reason);
        return sessionUser(result.user);
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = user.email ?? (profile as { email?: string } | undefined)?.email;
        if (!email) return false;

        let dbUser = await prisma.user.findUnique({ where: { email } });

        if (!dbUser) {
          // Determine desired role from cookie (set by /api/auth/oauth-role before OAuth redirect)
          let role: UserRole = UserRole.STUDENT;
          try {
            const { cookies } = await import("next/headers");
            const cookieStore = await cookies();
            const roleCookie = cookieStore.get("oauth_register_role")?.value;
            if (roleCookie === UserRole.PARENT) role = UserRole.PARENT;
          } catch {
            // Ignore, use default role
          }

          const rawName = (profile as { name?: string } | undefined)?.name ?? user.name ?? "";
          const nameParts = rawName.trim().split(" ");
          const firstName = nameParts[0] ?? "User";
          const lastName = nameParts.slice(1).join(" ") || "";

          const org = await ensureDefaultOrganization();
          dbUser = await prisma.user.create({
            data: {
              email,
              firstName,
              lastName,
              role,
              organizationId: org.id,
              isActive: true,
              passwordHash: "!OAUTH_GOOGLE",
            },
          });
        }

        // Attach our DB fields to the user object so the jwt callback can read them
        user.id = dbUser.id;
        (user as unknown as Record<string, unknown>).role = dbUser.role;
        (user as unknown as Record<string, unknown>).organizationId = dbUser.organizationId;
        (user as unknown as Record<string, unknown>).firstName = dbUser.firstName;
        (user as unknown as Record<string, unknown>).lastName = dbUser.lastName;
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as { role: UserRole }).role;
        token.organizationId = (user as { organizationId?: string }).organizationId ?? null;
        token.firstName = (user as { firstName?: string }).firstName ?? "";
        token.lastName = (user as { lastName?: string }).lastName ?? "";
        // Create a tracked session record so the Security tab can list/revoke sessions
        const sessionToken = crypto.randomUUID();
        await prisma.userSession.create({
          data: {
            userId: user.id,
            sessionToken,
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        token.sessionId = sessionToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as typeof session.user.role;
        session.user.organizationId = (token.organizationId as string | null) ?? null;
        session.user.firstName = (token.firstName as string) ?? "";
        session.user.lastName = (token.lastName as string) ?? "";

        // Re-read from the DB every request (deduped per request by React cache), never from the
        // JWT. See the note in next-auth.d.ts: a stale membership is a child-data boundary that
        // stays open after it should have closed.
        const memberships = await getSchoolMemberships(token.sub);
        session.user.schoolMemberships = memberships;
        session.user.activeSchoolId = memberships[0]?.schoolId ?? null;
        session.user.permissions = await getUserPermissions(token.sub);
        session.user.sessionToken = token.sessionId;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) {
        return;
      }
      await trackEvent({
        userId: user.id,
        eventType: "auth",
        eventName: "login",
      });
    },
    async signOut({ token }) {
      // Clean up the session record when the user explicitly signs out
      const sessionId = (token as { sessionId?: string })?.sessionId;
      if (sessionId) {
        await prisma.userSession.deleteMany({ where: { sessionToken: sessionId } });
      }
    },
  },
};

export function getServerAuthSession() {
  return getServerSession(authOptions);
}

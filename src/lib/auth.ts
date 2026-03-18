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
      },
      async authorize(credentials) {
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
            // Ignore — use default role
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

"use client";

import type { ReactNode } from "react";
import { signOut } from "next-auth/react";

/**
 * Host-correct sign out for BOTH surfaces (B2C apex and the school host).
 *
 * NextAuth has no custom `redirect` callback here, so its default resolves a relative
 * callbackUrl against NEXTAUTH_URL (the B2C apex). That means `signOut({ callbackUrl: "/login" })`
 * bounces a school-host user to the B2C /login on the apex. Signing out with `redirect: false`
 * and then hard-navigating keeps the user on the host they signed out from: the school host goes
 * to the school /login, the apex to the B2C /login (the /login page is itself host-aware).
 */
export function SignOutButton({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign("/login");
      }}
      className={className}
    >
      {children}
    </button>
  );
}

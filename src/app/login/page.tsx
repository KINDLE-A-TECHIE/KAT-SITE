import { Suspense } from "react";
import { headers } from "next/headers";
import { isSchoolHost } from "@/lib/host";
import { LoginForm } from "./login-form";

/**
 * `/login` is one shared page for B2C and B2B, but the two logins differ, so this SERVER component
 * resolves the host-dependent bits and hands them to the client <LoginForm>:
 *
 *  - GOOGLE is hidden on the school host. Google's OAuth redirect URI is bound to NEXTAUTH_URL (the
 *    apex), so a Google sign-in started on `schools.*` returns to the apex and sets the cookie
 *    there, leaving the school host signed out. School staff use credentials. (It also stays behind
 *    the NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED flag.)
 *  - The DEFAULT destination is host-aware. A gated user always returns to their callbackUrl (e.g.
 *    a school admin sent to /login?callbackUrl=/admin lands on /admin). But a fresh login with no
 *    callbackUrl should land where they belong: the school host defaults to /home (which routes to
 *    /admin or /teach by role), the apex to /dashboard.
 *
 * Resolving on the server also avoids a hydration flash of a Google button we're about to hide.
 */
export default async function LoginPage() {
  const host = (await headers()).get("host");
  const schoolHost = isSchoolHost(host);

  const googleEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true" && !schoolHost;
  const fallback = schoolHost ? "/home" : "/dashboard";

  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center bg-stone-50" />}
    >
      <LoginForm googleEnabled={googleEnabled} fallback={fallback} schoolHost={schoolHost} />
    </Suspense>
  );
}

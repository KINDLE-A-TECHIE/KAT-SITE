import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isSchoolHost, requiresAuth, schoolRootTarget } from "@/lib/host";

/**
 * Two jobs, both thin:
 *
 *  1. HOST ROUTING. On the school host (`schools.kindleatechie.com`, or any `schools.*` host in
 *     dev) the root `/` must serve the school surface, not the B2C kids' landing: the public B2B
 *     marketing page for logged-out prospects, the workspace hub (`/home`, which routes by role)
 *     for logged-in users. Everything else already routes correctly because the school paths
 *     (/admin, /teach, /learn, /home) don't collide with B2C paths.
 *
 *  2. LOGIN-GATING. `/dashboard` (B2C) and `/admin,/teach,/learn` (school) require a session.
 *     Per-role and per-tenant AUTHORIZATION is NOT done here; it stays in the pages via
 *     ensureSchoolMembership. The Edge middleware only has the JWT, which does not carry school
 *     memberships, so a role check here is impossible anyway.
 *
 * B2C is unchanged: on the apex host nothing is rewritten, and the only gated B2C path is
 * `/dashboard`, exactly as before this file grew past the stock `next-auth/middleware` re-export.
 */
export default withAuth(
  function middleware(req) {
    if (isSchoolHost(req.headers.get("host")) && req.nextUrl.pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = schoolRootTarget(Boolean(req.nextauth.token));
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      // Gates LOGIN only. `true` lets the request through; `false` redirects to /login. Role and
      // tenant checks happen in the pages.
      authorized: ({ token, req }) => (requiresAuth(req.nextUrl.pathname) ? Boolean(token) : true),
    },
  },
);

export const config = {
  // Runs on the school-host root (for the rewrite) and every login-gated area. The apex B2C
  // landing and all other public routes are otherwise untouched.
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/teach/:path*", "/learn/:path*"],
};

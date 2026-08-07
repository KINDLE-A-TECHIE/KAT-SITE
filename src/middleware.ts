import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
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
/**
 * The CSP `frame-ancestors` for one school's embed page. The embed opts OUT of X-Frame-Options (it cannot
 * express an allow-list), so this header is the ONLY thing restricting who may frame a school's embed.
 *
 * Edge middleware cannot reach Prisma, so it asks the Node route for the value. FAILS CLOSED to 'none' on
 * any failure or a missing slug: an embed that cannot prove who may frame it must not be framable at all.
 */
async function embedFrameAncestors(req: NextRequestWithAuth): Promise<string> {
  const slug = req.nextUrl.pathname.split("/")[2] ?? "";
  if (!slug) return "'none'";
  try {
    const res = await fetch(new URL(`/api/school/embed/frame-ancestors?slug=${encodeURIComponent(slug)}`, req.url));
    if (!res.ok) return "'none'";
    const data = (await res.json()) as { frameAncestors?: string };
    return data.frameAncestors?.trim() ? data.frameAncestors : "'none'";
  } catch {
    return "'none'";
  }
}

export default withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;

    // 1. School-host root rewrite.
    if (isSchoolHost(req.headers.get("host")) && pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = schoolRootTarget(Boolean(req.nextauth.token));
      return NextResponse.rewrite(url);
    }

    // 2. Per-school framing allow-list for the embed. Every /embed/* document is a framed page and gets a
    //    `frame-ancestors` header built from that school's SchoolAllowedOrigin list (or 'none').
    if (pathname.startsWith("/embed/")) {
      const res = NextResponse.next();
      res.headers.set("Content-Security-Policy", `frame-ancestors ${await embedFrameAncestors(req)}`);
      return res;
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      // Gates LOGIN only. `true` lets the request through; `false` redirects to /login. Role and
      // tenant checks happen in the pages. /embed authenticates with its OWN session, not NextAuth, so
      // requiresAuth returns false for it and it is never redirected here.
      authorized: ({ token, req }) => (requiresAuth(req.nextUrl.pathname) ? Boolean(token) : true),
    },
  },
);

export const config = {
  // Runs on the school-host root (for the rewrite), every login-gated area, and every embed document
  // (to set its per-school frame-ancestors). Other public routes are untouched.
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/teach/:path*", "/learn/:path*", "/embed/:path*"],
};

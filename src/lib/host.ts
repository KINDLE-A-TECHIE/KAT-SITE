/**
 * Host + path helpers for `src/middleware.ts`.
 *
 * Pure and edge-safe (no node/DB/next-auth imports) so the middleware stays fast and this logic
 * can be unit-tested in isolation. The middleware itself is a thin wrapper around these.
 */

const SCHOOL_HOST = "schools.kindleatechie.com";

/**
 * Is this request on the school host?
 *
 * True for the production host, and in dev for any `schools.*` host so that
 * `http://schools.localhost:3000` simulates the subdomain with no hosts-file edit (browsers
 * resolve `*.localhost` to 127.0.0.1, and Next dev accepts it). For curl/CI, pass
 * `-H "Host: schools.kindleatechie.com"`.
 *
 * The Host header is set by the platform/proxy in production, so trusting it here is safe: the
 * worst a spoofed `schools.*` host can do is serve the (guarded) school surface, no data is
 * exposed from the host alone; the pages still check the session.
 */
export function isSchoolHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0].toLowerCase();
  return h === SCHOOL_HOST || h.startsWith("schools.");
}

/**
 * Paths gated by LOGIN (authentication) in middleware. Per-tenant and per-role AUTHORIZATION is
 * deliberately NOT done here: it lives in the pages via ensureSchoolMembership, because the Edge
 * middleware only sees the JWT, which does not carry school memberships. The trailing-slash guard
 * means `/admin` matches but `/administrator` does not.
 */
const AUTH_PREFIXES = ["/dashboard", "/admin", "/teach", "/learn"];

export function requiresAuth(pathname: string): boolean {
  return AUTH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Where the school host's root `/` should rewrite to.
 *
 * Logged-out visitors (prospective schools) get the public B2B marketing landing; logged-in users
 * get the workspace hub (`/home`), which routes them on to /admin, /teach, or /learn by role (see
 * `(school)/home`). Middleware can tell logged-in from out via token presence, but NOT the role,
 * which is why the role routing lives in the page, not here.
 */
export function schoolRootTarget(isAuthenticated: boolean): "/home" | "/schools" {
  return isAuthenticated ? "/home" : "/schools";
}

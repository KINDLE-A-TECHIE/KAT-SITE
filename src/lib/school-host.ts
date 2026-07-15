/**
 * School-host detection + the (school) route-group path list.
 *
 * Imported by `src/middleware.ts`, so this module must stay EDGE-SAFE:
 * no prisma, no "server-only", no Node built-ins.
 *
 * The (school) route group adds no URL segment, so its pages resolve at
 * /admin, /teach, /learn, /home on EVERY host. The middleware uses this list to
 * serve them on the school host and 404 them on the B2C host, keeping the
 * school app invisible on kindleatechie.com.
 */

/** Production host for the school (B2B) surface. */
export const SCHOOL_HOST = process.env.SCHOOL_HOST ?? "schools.kindleatechie.com";

/** Top-level segments owned by the (school) route group. */
export const SCHOOL_PATHS = ["/home", "/admin", "/teach", "/learn", "/embed"] as const;

/** Segment for the iframe-embeddable learner surface. */
export const EMBED_PATH = "/embed";

/**
 * True for the embeddable surface.
 *
 * It is a school path (so it 404s on the B2C host like the rest), but it is the ONE school path
 * that must not require a NextAuth session: it authenticates itself with a single-use launch token
 * and its own cookie. Middleware special-cases it for exactly that reason.
 */
export function isEmbedPath(pathname: string): boolean {
  return pathname === EMBED_PATH || pathname.startsWith(`${EMBED_PATH}/`);
}

/** The school slug out of /embed/<slug>. */
export function embedSlug(pathname: string): string | null {
  const m = /^\/embed\/([^/]+)/.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Header escape hatch for curl/tests to simulate the school host. */
export const SCHOOL_HOST_HEADER = "x-school-host";

/** True when the request path belongs to the (school) route group. */
export function isSchoolPath(pathname: string): boolean {
  return SCHOOL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * True when this request targets the school surface.
 *
 * Matches, in order:
 *  - the configured production host (SCHOOL_HOST env)
 *  - any `schools.*` host, which makes http://schools.localhost:3000 work in
 *    local dev with no hosts-file edit (browsers resolve *.localhost to 127.0.0.1)
 *  - an explicit `x-school-host: 1` header, for curl and tests
 */
export function isSchoolHost(host: string | null, schoolHostHeader?: string | null): boolean {
  if (schoolHostHeader === "1") return true;
  if (!host) return false;
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === SCHOOL_HOST.split(":")[0].toLowerCase()) return true;
  return hostname.startsWith("schools.");
}

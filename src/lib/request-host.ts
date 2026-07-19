import "server-only";
import { isSchoolHost } from "./host";
import { SCHOOL_HOST } from "./school-host";

/**
 * The request's public origin, honouring a reverse proxy's forwarded headers and falling back to the
 * request URL. Uses `||` (not `??`) for each fallback so a present-but-empty forwarded header does
 * not produce a malformed `://host` origin. Internal, prefer schoolLaunchOrigin for pupil links.
 */
function publicOrigin(request: Request): string {
  const h = request.headers;
  const url = new URL(request.url);
  const fwdProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const fwdHost = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = fwdProto || url.protocol.replace(/:$/, "");
  const host = fwdHost || h.get("host") || url.host;
  return `${proto}://${host}`;
}

/**
 * The trusted origin for pupil sign-in links, the launch QR and the printed-card URL.
 *
 * FIXED in production to the configured school host, so a forged Host / x-forwarded-host cannot
 * point a single-use launch token at an attacker domain (host-header injection). In development it
 * falls back to the request's own origin so `schools.localhost:3000` still works with no config.
 */
export function schoolLaunchOrigin(request: Request): string {
  if (process.env.NODE_ENV === "production") return `https://${SCHOOL_HOST}`;
  return publicOrigin(request);
}

/**
 * True when these request headers target the school (B2B) host.
 *
 * Reads the raw Host header, the SAME signal src/middleware.ts routes the rest of the (school)
 * surface on, so /student-login and /student-launch are confined under identical conditions to
 * /admin, /teach, /learn (no divergence from a forwarded-vs-raw host mismatch).
 */
export function isSchoolHostHeaders(headers: Headers): boolean {
  return isSchoolHost(headers.get("host"));
}

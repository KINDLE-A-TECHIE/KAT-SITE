/**
 * Sanitise a post-login redirect target.
 *
 * The login page navigates with window.location.assign(), so an attacker-supplied
 * absolute URL ("https://evil.com") or protocol-relative one ("//evil.com") would
 * be an open redirect. Only a single leading slash is accepted.
 *
 * Staying relative is also what keeps the user on the host they logged in from,
 * that is what returns a school user to schools.<domain>/teach instead of the
 * apex (where the school paths deliberately 404).
 */
export function safeRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null; // absolute URLs, javascript: etc.
  if (raw.startsWith("//")) return null; // protocol-relative → external host
  if (raw.startsWith("/\\")) return null; // backslash trick some browsers normalise
  return raw;
}

/**
 * Resolve where to send a user after login.
 * `callbackUrl` is what NextAuth/middleware send; `redirect` is used by our own
 * internal links (register, fellowship apply). Honour both, then fall back.
 */
export function resolveLoginRedirect(
  callbackUrl: string | null | undefined,
  redirect: string | null | undefined,
  fallback = "/dashboard",
): string {
  return safeRedirect(callbackUrl) ?? safeRedirect(redirect) ?? fallback;
}

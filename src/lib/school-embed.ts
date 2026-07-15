import "server-only";
import { randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { checkEnrollmentLicense } from "./school-license";

/**
 * Embed launch tokens, magic-link SSO into an iframe on a school's own site.
 *
 * SHAPE BORROWED FROM LTI 1.3 (1EdTech), the actual industry standard for launching an ed-tech tool
 * from a school's system: a short-lived signed launch token, a single-use nonce (our `jti`), and
 * `iss`/`aud`, with roles resolved AT LAUNCH rather than trusted from the token. Keeping the shape
 * means adopting real LTI later is an addition, not a migration.
 *
 * WE SIGN, THE SCHOOL DOESN'T. The school authenticates with an API key and we mint. No shared
 * signing secret at the school's end means no alg-confusion, no `alg: none`, no clock-skew, and no
 * key material sitting in someone's PHP file.
 *
 * TWO DISTINCT TOKENS, and conflating them would be the whole vulnerability:
 *   LAUNCH  (aud "kat:embed:launch"), 60s, single-use, travels in a URL fragment.
 *   SESSION (aud "kat:embed:session"), 30min, lives in an HttpOnly cookie, never in a URL.
 * A launch token is NOT a session and cannot be presented as one; the audience check is what
 * enforces that.
 */

const ISSUER = "kat";
const LAUNCH_AUD = "kat:embed:launch";
const SESSION_AUD = "kat:embed:session";

/** 60s to redeem. Long enough for a page to load on a bad line; short enough that a token glimpsed
 *  on a projector is worthless by the time anyone types it. */
export const LAUNCH_TTL_SECONDS = 60;
/** The framed session itself. Re-launching is cheap, so it need not be long. */
export const SESSION_TTL_SECONDS = 30 * 60;

export const EMBED_COOKIE = "kat_embed_session";

/** Only a learner may be embedded in v1. A teacher embed would render a roster of minors onto a page
 *  whose security we do not control, see SCHOOL-BUILD-NOTES. */
export type EmbedPurpose = "learn";

export type LaunchClaims = {
  schoolId: string;
  userId: string;
  purpose: EmbedPurpose;
};

export type SessionClaims = LaunchClaims;

function secret(): Uint8Array {
  const value = process.env.EMBED_TOKEN_SECRET;
  if (!value || value.length < 32) {
    // Fail loudly rather than sign children's sessions with a weak or absent key.
    throw new Error("EMBED_TOKEN_SECRET is missing or shorter than 32 characters.");
  }
  return new TextEncoder().encode(value);
}

// ---------------------------------------------------------------------------- mint

/** Mints a single-use launch token. The caller must ALREADY have proved the school owns the user. */
export async function mintLaunchToken(claims: LaunchClaims): Promise<{ token: string; expiresAt: Date }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + LAUNCH_TTL_SECONDS) * 1000);

  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(LAUNCH_AUD)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + LAUNCH_TTL_SECONDS)
    .sign(secret());

  return { token, expiresAt };
}

async function mintSessionToken(claims: SessionClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(SESSION_AUD)
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(secret());
}

// ---------------------------------------------------------------------------- verify

type Verified = LaunchClaims & { jti: string | null };

async function verify(token: string, audience: string): Promise<Verified | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience, // the line that stops a launch token being used as a session
      algorithms: ["HS256"], // pinned: never let the token pick its own algorithm
    });
    const { schoolId, userId, purpose, jti } = payload as Record<string, unknown>;
    if (typeof schoolId !== "string" || typeof userId !== "string" || purpose !== "learn") {
      return null;
    }
    return { schoolId, userId, purpose, jti: typeof jti === "string" ? jti : null };
  } catch {
    return null; // bad signature, expired, wrong audience/issuer, all indistinguishable to a caller
  }
}

/** Reads an embed SESSION cookie. Returns null unless it is valid and current. */
export async function readEmbedSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  const v = await verify(token, SESSION_AUD);
  return v ? { schoolId: v.schoolId, userId: v.userId, purpose: v.purpose } : null;
}

export type RedeemResult =
  | { ok: true; claims: SessionClaims; sessionToken: string; maxAge: number }
  | { ok: false; reason: string };

/**
 * Spends a launch token and issues an embed session.
 *
 * EVERY claim is re-checked against the database. A signature proves the token is ours; it does not
 * prove the facts inside it are still true. Between minting and redemption a pupil may have left the
 * school, been unenrolled, or the school's licence may have lapsed, and this token is a key to a
 * child's account.
 */
export async function redeemLaunchToken(token: string, schoolSlug: string): Promise<RedeemResult> {
  const claims = await verify(token, LAUNCH_AUD);
  if (!claims) return { ok: false, reason: "Invalid or expired launch token." };

  // The slug in the URL must be the school in the token. Otherwise a valid token for school A,
  // replayed at school B's embed URL, would render inside B's page.
  const school = await prisma.school.findUnique({
    where: { slug: schoolSlug },
    select: { id: true },
  });
  if (!school || school.id !== claims.schoolId) {
    return { ok: false, reason: "Invalid or expired launch token." };
  }

  // A token with no jti cannot be spent, so it cannot be made single-use, refuse it rather than
  // invent an id and let it be replayed.
  if (!claims.jti) return { ok: false, reason: "Invalid or expired launch token." };

  // SINGLE USE. The insert IS the lock: `jti` is the primary key, so a concurrent replay loses on a
  // unique violation rather than on a check-then-act race we would have to reason about.
  try {
    await prisma.embedTokenUse.create({
      data: {
        jti: claims.jti,
        schoolId: claims.schoolId,
        expiresAt: new Date(Date.now() + LAUNCH_TTL_SECONDS * 1000),
      },
    });
  } catch {
    return { ok: false, reason: "This launch link has already been used." };
  }

  // The pupil must STILL be a pupil of this school, right now.
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId: claims.userId, schoolId: claims.schoolId, status: "ACTIVE" },
    select: { schoolId: true, schoolClassId: true },
  });
  if (!enrollment) return { ok: false, reason: "This pupil is not enrolled at the school." };

  // And the school's licence must be active for the class's term, the same gate as /learn. An
  // embed must not become a way around the thing the school pays for.
  const gate = await checkEnrollmentLicense(enrollment);
  if (!gate.allowed) return { ok: false, reason: gate.reason };

  const sessionToken = await mintSessionToken(claims);
  return { ok: true, claims, sessionToken, maxAge: SESSION_TTL_SECONDS };
}

// ---------------------------------------------------------------------------- cookie

/**
 * The embed session cookie, built by hand rather than via cookies().set().
 *
 *   SameSite=None, required, or the browser will not send it inside a cross-site iframe at all.
 *   Secure       , mandatory alongside SameSite=None.
 *   Partitioned   . CHIPS. Keyed to (our site, the school's top-level site), so one school's embed
 *                    cannot see another's, and it survives third-party cookie blocking in
 *                    Chrome/Edge.
 *   HttpOnly     , a same-origin XSS in the embed still cannot read it.
 *
 * PATH=/, NOT /embed, and the reason matters. A Path=/embed cookie is never sent to
 * /api/school/embed/*, so the embed's own API calls (including the "did my cookie stick?" probe)
 * would silently receive nothing and the Safari fallback would fire for everyone.
 *
 * The cost of Path=/ is that a SameSite=None cookie rides along on CROSS-SITE requests, i.e. CSRF.
 * That is bounded here, deliberately:
 *   - Nothing else in the app reads this cookie. NextAuth verifies its own, differently-named JWT,
 *     so this can never authenticate a B2C request.
 *   - Every embed endpoint that CHANGES anything calls assertEmbedOrigin() below.
 *   - The main NextAuth cookie stays SameSite=Lax. Embedding does not weaken the B2C product.
 */
export function buildEmbedCookie(sessionToken: string, maxAge: number): string {
  return [
    `${EMBED_COOKIE}=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=None",
    "Partitioned",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function clearEmbedCookie(): string {
  return `${EMBED_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`;
}

/**
 * CSRF guard for embed endpoints that mutate.
 *
 * The embed cookie is SameSite=None, so the browser attaches it to cross-site requests too. A
 * mutating endpoint must therefore prove the request came from a page we allow: the school's own
 * origin (its allow-list) or ourselves. Anything else, a random site that got a pupil to visit it
 * while their embed session was live, is refused.
 */
export async function assertEmbedOrigin(request: Request, schoolId: string): Promise<boolean> {
  const origin = request.headers.get("origin");

  // Same-origin fetches from our own pages may omit Origin entirely; when present it equals us.
  const self = new URL(request.url).origin;
  if (!origin || origin === self) return true;

  const allowed = await prisma.schoolAllowedOrigin.findFirst({
    where: { schoolId, origin },
    select: { id: true },
  });
  return Boolean(allowed);
}

// ---------------------------------------------------------------------------- origins

/**
 * The CSP `frame-ancestors` value for a school.
 *
 * FAILS CLOSED: a school with no configured origins gets `'none'`, it cannot be framed at all,
 * rather than being framed by anyone.
 *
 * Note X-Frame-Options cannot express a list (ALLOW-FROM is dead and was never widely supported),
 * which is why it is dropped for /embed in next.config.ts and this replaces it. CORS is irrelevant
 * here, it governs XHR, not framing.
 */
export async function frameAncestorsFor(schoolSlug: string): Promise<string> {
  const school = await prisma.school.findUnique({
    where: { slug: schoolSlug },
    select: { origins: { select: { origin: true } } },
  });
  const origins = school?.origins.map((o) => o.origin) ?? [];
  if (origins.length === 0) return "'none'";
  return origins.join(" ");
}

/** Exact origin, https only, no path, no wildcard. */
export function isValidOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname.includes("*")) return false;
    if (url.pathname !== "/" || url.search || url.hash) return false;
    return value === url.origin;
  } catch {
    return false;
  }
}
